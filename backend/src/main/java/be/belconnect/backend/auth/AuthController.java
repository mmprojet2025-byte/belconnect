package be.belconnect.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSender;
import org.springframework.mail.SimpleMailMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final AccountRepository accounts;
    private final MobileAuthController accountDeletion;
    private final PasswordEncoder passwords;
    private final HttpSessionSecurityContextRepository contexts;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final ObjectProvider<MailSender> mailProvider;
    private final String mailFrom;
    private final String publicUrl;
    private final SecureRandom random = new SecureRandom();
    private final String dummyHash;
    private final ConcurrentHashMap<String, Window> attempts = new ConcurrentHashMap<>();
    private record Window(long start, int count) {}
    public AuthController(AccountRepository accounts, MobileAuthController accountDeletion, PasswordEncoder passwords, HttpSessionSecurityContextRepository contexts,
            JdbcTemplate jdbc, TransactionTemplate transactions, ObjectProvider<MailSender> mailProvider,
            @Value("${MAIL_FROM:}") String mailFrom,
            @Value("${APP_PUBLIC_URL:http://localhost:5173}") String publicUrl) {
        this.accounts = accounts; this.accountDeletion = accountDeletion; this.passwords = passwords; this.contexts = contexts;
        this.jdbc = jdbc; this.transactions = transactions; this.mailProvider = mailProvider;
        this.mailFrom = mailFrom; this.publicUrl = publicUrl.replaceAll("/+$", "");
        this.dummyHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }
    static String normalizedEmail(String value) { return value == null ? null : value.strip().toLowerCase(Locale.ROOT); }
    public record Registration(@NotBlank @Size(max=80) String firstName, @NotBlank @Size(max=80) String lastName,
            @NotBlank @Email @Size(max=254) String email, @NotBlank @Size(min=12,max=72) String password) {
        public Registration { firstName = firstName == null ? null : firstName.strip(); lastName = lastName == null ? null : lastName.strip(); email = normalizedEmail(email); }
    }
    public record Login(@NotBlank @Email @Size(max=254) String email, @NotBlank @Size(max=72) String password) {
        public Login { email = normalizedEmail(email); }
    }
    public record ProfileUpdate(@NotBlank @Size(max=80) String firstName, @NotBlank @Size(max=80) String lastName) {
        public ProfileUpdate { firstName = firstName == null ? null : firstName.strip(); lastName = lastName == null ? null : lastName.strip(); }
    }
    public record RecoveryRequest(@NotBlank @Email @Size(max=254) String email) {
        public RecoveryRequest { email = normalizedEmail(email); }
    }
    public record PasswordReset(@NotBlank @Size(max=128) String token, @NotBlank @Size(min=12,max=72) String password) {}
    @GetMapping("/csrf")
    public Map<String,String> csrf(CsrfToken token) { return Map.of("token",token.getToken(),"headerName",token.getHeaderName()); }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public AccountRepository.Profile register(@Valid @RequestBody Registration body, HttpServletRequest request, HttpServletResponse response) {
        limit(request, response); checkPasswordBytes(body.password());
        AccountRepository.Profile profile;
        try { profile = accounts.create(body.firstName(),body.lastName(),body.email(),passwords.encode(body.password())); }
        catch (DuplicateKeyException exception) { throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette adresse e-mail est déjà utilisée."); }
        establishSession(profile,request,response);
        return profile;
    }

    @PostMapping("/login")
    public AccountRepository.Profile login(@Valid @RequestBody Login body, HttpServletRequest request, HttpServletResponse response) {
        limit(request,response); checkPasswordBytes(body.password());
        var account = accounts.findByEmail(body.email()).orElse(null);
        boolean matches = passwords.matches(body.password(), account == null ? dummyHash : account.passwordHash());
        if (!matches || account == null || !"ACTIF".equals(account.status())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Adresse e-mail ou mot de passe incorrect.");
        establishSession(account.profile(),request,response);
        return account.profile();
    }

    @GetMapping("/me")
    public AccountRepository.Profile me(Authentication authentication, HttpServletRequest request) {
        var account = accounts.findByEmail(authentication.getName()).orElse(null);
        if (account == null || !"ACTIF".equals(account.status())) {
            if(request.getSession(false) != null) request.getSession(false).invalidate();
            SecurityContextHolder.clearContext();
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter.");
        }
        return account.profile();
    }

    @PostMapping("/delete") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(Authentication authentication, @Valid @RequestBody MobileAuthController.DeleteAccount body,
                              HttpServletRequest request) {
        accountDeletion.deleteAccount(authentication, body);
        if (request.getSession(false) != null) request.getSession(false).invalidate();
        SecurityContextHolder.clearContext();
    }

    @PostMapping("/profile")
    public AccountRepository.Profile updateProfile(Authentication authentication, @Valid @RequestBody ProfileUpdate body) {
        return accounts.updateName(authentication.getName(), body.firstName(), body.lastName())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }

    @PostMapping("/password/recovery") @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestRecovery(@Valid @RequestBody RecoveryRequest body, HttpServletRequest request, HttpServletResponse response) {
        limit(request, response);
        MailSender sender = mailProvider.getIfAvailable();
        if (sender == null || mailFrom.isBlank())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "L'envoi d'e-mails n'est pas encore configuré.");
        var account = accounts.findByEmail(body.email()).orElse(null);
        if (account == null || !"ACTIF".equals(account.status())) return;
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash = tokenHash(token);
        long id = jdbc.queryForObject("""
            INSERT INTO reinitialisation_mot_de_passe(utilisateur_id,jeton_hash,date_expiration)
            VALUES (?, ?, now()+interval '30 minutes') RETURNING id
            """, Long.class, account.profile().id(), hash);
        var message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(account.profile().email());
        message.setSubject("Belconnect — réinitialiser votre mot de passe");
        message.setText("Pour définir un nouveau mot de passe, ouvrez ce lien dans les 30 minutes :\n\n"
            + publicUrl + "/reinitialiser-mot-de-passe#jeton=" + token
            + "\n\nSi vous n'avez pas fait cette demande, ignorez cet e-mail.");
        try {
            sender.send(message);
            jdbc.update("DELETE FROM reinitialisation_mot_de_passe WHERE utilisateur_id=? AND id<>?", account.profile().id(), id);
        } catch (MailException ex) {
            jdbc.update("DELETE FROM reinitialisation_mot_de_passe WHERE id=?", id);
            log.warn("L'envoi d'un lien de récupération a échoué ; aucun détail de compte n'est renvoyé au navigateur");
        }
    }

    @PostMapping("/password/reset") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody PasswordReset body, HttpServletRequest request, HttpServletResponse response) {
        limit(request, response); checkPasswordBytes(body.password());
        if (!body.token().matches("[A-Za-z0-9_-]{43}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ce lien de réinitialisation est invalide ou expiré.");
        String hash = tokenHash(body.token());
        Boolean changed = transactions.execute(status -> {
            var rows = jdbc.queryForList("""
                SELECT r.utilisateur_id FROM reinitialisation_mot_de_passe r
                JOIN utilisateur u ON u.id=r.utilisateur_id
                WHERE r.jeton_hash=? AND r.date_expiration>now() AND u.statut='ACTIF' FOR UPDATE OF r
                """, hash);
            if (rows.isEmpty()) return false;
            long userId = ((Number)rows.getFirst().get("utilisateur_id")).longValue();
            jdbc.update("UPDATE utilisateur SET mot_de_passe_hash=? WHERE id=? AND statut='ACTIF'", passwords.encode(body.password()), userId);
            jdbc.update("DELETE FROM reinitialisation_mot_de_passe WHERE utilisateur_id=?", userId);
            return true;
        });
        if (!Boolean.TRUE.equals(changed))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ce lien de réinitialisation est invalide ou expiré.");
    }

    private static String tokenHash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII))); }
        catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private void establishSession(AccountRepository.Profile profile, HttpServletRequest request, HttpServletResponse response) {
        // Discard the anonymous or previous session, rotating both session ID and CSRF token.
        if(request.getSession(false) != null) request.getSession(false).invalidate();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(profile.email(), null, AuthorityUtils.createAuthorityList("ROLE_USER")));
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context,request,response);
        request.getSession().setAttribute(CredentialSessionFilter.SESSION_HASH,
            accounts.findByEmail(profile.email()).orElseThrow().passwordHash());
    }
    private void checkPasswordBytes(String password) {
        if(password.getBytes(StandardCharsets.UTF_8).length > 72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Le mot de passe ne peut pas dépasser 72 octets UTF-8.");
    }
    private void limit(HttpServletRequest request, HttpServletResponse response) {
        long now = System.currentTimeMillis();
        attempts.entrySet().removeIf(entry -> now - entry.getValue().start() > 60_000);
        if(attempts.size() > 10_000) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Réessayez dans une minute.");
        var window = attempts.compute(request.getRemoteAddr(), (key, old) -> old == null || now-old.start() >= 60_000 ? new Window(now,1) : new Window(old.start(),old.count()+1));
        if(window.count() > 20) { response.setHeader("Retry-After","60"); throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Trop de tentatives. Réessayez dans une minute."); }
    }
}
