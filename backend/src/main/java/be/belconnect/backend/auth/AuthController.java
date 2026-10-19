package be.belconnect.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AccountRepository accounts;
    private final PasswordEncoder passwords;
    private final HttpSessionSecurityContextRepository contexts;
    private final String dummyHash;
    private final ConcurrentHashMap<String, Window> attempts = new ConcurrentHashMap<>();
    private record Window(long start, int count) {}
    public AuthController(AccountRepository accounts, PasswordEncoder passwords, HttpSessionSecurityContextRepository contexts) {
        this.accounts = accounts; this.passwords = passwords; this.contexts = contexts;
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

    @PostMapping("/profile")
    public AccountRepository.Profile updateProfile(Authentication authentication, @Valid @RequestBody ProfileUpdate body) {
        return accounts.updateName(authentication.getName(), body.firstName(), body.lastName())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }

    private void establishSession(AccountRepository.Profile profile, HttpServletRequest request, HttpServletResponse response) {
        // Discard the anonymous or previous session, rotating both session ID and CSRF token.
        if(request.getSession(false) != null) request.getSession(false).invalidate();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(profile.email(), null, AuthorityUtils.createAuthorityList("ROLE_USER")));
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context,request,response);
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
