package be.belconnect.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/mobile/auth")
public class MobileAuthController {
    private final AccountRepository accounts;
    private final PasswordEncoder passwords;
    private final MobileTokenService tokens;
    private final String dummyHash;
    private final ConcurrentHashMap<String,Window> attempts=new ConcurrentHashMap<>();
    private record Window(long start,int count) {}
    public record Registration(@NotBlank @Size(max=80) String firstName,@NotBlank @Size(max=80) String lastName,
        @NotBlank @Email @Size(max=254) String email,@NotBlank @Size(min=12,max=72) String password) {
        public Registration { firstName=firstName==null?null:firstName.strip(); lastName=lastName==null?null:lastName.strip(); email=normalize(email); }
    }
    public record Login(@NotBlank @Email @Size(max=254) String email,@NotBlank @Size(max=72) String password) {
        public Login { email=normalize(email); }
    }
    public record Session(AccountRepository.Profile profile,String token) {}
    public record AvatarChoice(@NotBlank @Pattern(regexp="mint|amber|coral|blue") String avatarCode) {}

    public MobileAuthController(AccountRepository accounts,PasswordEncoder passwords,MobileTokenService tokens) {
        this.accounts=accounts; this.passwords=passwords; this.tokens=tokens; this.dummyHash=passwords.encode(java.util.UUID.randomUUID().toString());
    }
    private static String normalize(String email) { return email==null?null:email.strip().toLowerCase(Locale.ROOT); }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public Session register(@Valid @RequestBody Registration body,HttpServletRequest request) {
        limit(request); checkPassword(body.password());
        AccountRepository.Profile profile;
        try { profile=accounts.create(body.firstName(),body.lastName(),body.email(),passwords.encode(body.password())); }
        catch(DuplicateKeyException ex) { throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette adresse e-mail est déjà utilisée."); }
        var account=accounts.findByEmail(profile.email()).orElseThrow();
        return new Session(profile,tokens.issue(account));
    }

    @PostMapping("/login")
    public Session login(@Valid @RequestBody Login body,HttpServletRequest request) {
        limit(request); checkPassword(body.password());
        var account=accounts.findByEmail(body.email()).orElse(null);
        boolean matches=passwords.matches(body.password(),account==null?dummyHash:account.passwordHash());
        if(!matches || account==null || !"ACTIF".equals(account.status())) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Adresse e-mail ou mot de passe incorrect.");
        return new Session(account.profile(),tokens.issue(account));
    }

    @GetMapping("/me")
    public AccountRepository.Profile me(Authentication authentication) { return accounts.findByEmail(authentication.getName()).orElseThrow().profile(); }

    @PutMapping("/avatar")
    public AccountRepository.Profile updateAvatar(Authentication authentication, @Valid @RequestBody AvatarChoice choice) {
        return accounts.updateAvatar(authentication.getName(), choice.avatarCode())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader("Authorization") String authorization) { tokens.revoke(authorization.substring(7)); }

    private void checkPassword(String password) { if(password.getBytes(StandardCharsets.UTF_8).length>72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Le mot de passe ne peut pas dépasser 72 octets UTF-8."); }
    private void limit(HttpServletRequest request) {
        long now=System.currentTimeMillis(); attempts.entrySet().removeIf(e->now-e.getValue().start()>60_000);
        var window=attempts.compute(request.getRemoteAddr(),(key,old)->old==null||now-old.start()>=60_000?new Window(now,1):new Window(old.start(),old.count()+1));
        if(window.count()>20) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Trop de tentatives. Réessayez dans une minute.");
    }
}
