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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/mobile/auth")
public class MobileAuthController {
    private final AccountRepository accounts;
    private final PasswordEncoder passwords;
    private final MobileTokenService tokens;
    private final JdbcTemplate jdbc;
    private final String dummyHash;
    private final ConcurrentHashMap<String,Window> attempts=new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String,Window> deletionAttempts=new ConcurrentHashMap<>();
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
    public record DeleteAccount(@NotBlank String password) {}

    public MobileAuthController(AccountRepository accounts,PasswordEncoder passwords,MobileTokenService tokens,JdbcTemplate jdbc) {
        this.accounts=accounts; this.passwords=passwords; this.tokens=tokens; this.jdbc=jdbc; this.dummyHash=passwords.encode(java.util.UUID.randomUUID().toString());
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

    @DeleteMapping("/me") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void deleteAccount(Authentication authentication,@Valid @RequestBody DeleteAccount body) {
        if(authentication==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        long now=System.currentTimeMillis();
        deletionAttempts.entrySet().removeIf(entry -> now-entry.getValue().start()>=900_000);
        var deletionWindow=deletionAttempts.compute(authentication.getName(),(key,old)->old==null||now-old.start()>=900_000?new Window(now,1):new Window(old.start(),old.count()+1));
        if(deletionWindow.count()>5) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Trop de tentatives de suppression. Réessayez dans quinze minutes.");
        var rows=jdbc.queryForList("SELECT id,mot_de_passe_hash FROM utilisateur WHERE email=? AND statut='ACTIF' FOR UPDATE",authentication.getName());
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        long id=((Number)rows.getFirst().get("id")).longValue();
        if(!passwords.matches(body.password(),(String)rows.getFirst().get("mot_de_passe_hash")))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Mot de passe incorrect.");
        boolean responsible=Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=?) OR
              EXISTS(SELECT 1 FROM espace_organisateur WHERE createur_id=? AND statut<>'FERME') OR
              EXISTS(SELECT 1 FROM appartenance_espace WHERE utilisateur_id=? AND role='ADMINISTRATEUR' AND statut='ACTIF')
            """,Boolean.class,id,id,id));
        if(responsible) throw new ResponseStatusException(HttpStatus.CONFLICT,"Transférez ou fermez vos responsabilités de gestion sur le web avant de supprimer ce compte.");
        if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM reservation_payante_activite WHERE utilisateur_id=? AND statut IN ('EN_ATTENTE','PAYE','REMBOURSEMENT_EN_COURS'))",Boolean.class,id)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Terminez vos réservations payantes ou contactez le support avant de supprimer le compte.");
        if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM inscription_payante_projet WHERE participant_id=? AND statut IN ('EN_ATTENTE','PAYE','REMBOURSEMENT_EN_COURS'))",Boolean.class,id)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Réglez vos participations payantes aux projets avant de supprimer le compte.");
        jdbc.update("UPDATE inscription_gratuite_projet SET statut='ANNULEE',date_annulation=now() WHERE participant_id=? AND statut='CONFIRMEE'",id);
        var freeBookings=jdbc.queryForList("""
            SELECT i.id,i.activite_id,i.quantite FROM inscription_activite i JOIN activite a ON a.id=i.activite_id
            WHERE i.utilisateur_id=? AND i.statut='CONFIRMEE' AND a.debut>now() FOR UPDATE OF a,i
            """,id);
        for(var booking:freeBookings) {
            jdbc.update("UPDATE inscription_activite SET statut='ANNULEE',date_annulation=now(),version=version+1 WHERE id=?",booking.get("id"));
            jdbc.update("UPDATE activite SET places_disponibles=places_disponibles+? WHERE id=?",booking.get("quantite"),booking.get("activite_id"));
        }
        jdbc.update("UPDATE inscription_activite SET prenom='Compte',nom='supprimé',email=?,telephone='' WHERE utilisateur_id=?", "supprime-"+id+"@accounts.invalid",id);
        jdbc.update("DELETE FROM session_mobile WHERE utilisateur_id=?",id);
        jdbc.update("UPDATE appartenance_groupe SET statut='RETIRE',date_depart_volontaire=NULL WHERE utilisateur_id=?",id);
        jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=?",id);
        jdbc.update("UPDATE invitation_groupe SET statut='REFUSEE',date_decision=now(),date_lecture=now() WHERE invite_id=? AND statut='EN_ATTENTE'",id);
        jdbc.update("UPDATE utilisateur SET email=?,prenom='Compte',nom='supprimé',avatar_code=NULL,mot_de_passe_hash=?,statut='DESACTIVE',date_suppression=now() WHERE id=?",
            "supprime-"+id+"@accounts.invalid",passwords.encode(java.util.UUID.randomUUID().toString()),id);
    }

    private void checkPassword(String password) { if(password.getBytes(StandardCharsets.UTF_8).length>72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Le mot de passe ne peut pas dépasser 72 octets UTF-8."); }
    private void limit(HttpServletRequest request) {
        long now=System.currentTimeMillis(); attempts.entrySet().removeIf(e->now-e.getValue().start()>60_000);
        var window=attempts.compute(request.getRemoteAddr(),(key,old)->old==null||now-old.start()>=60_000?new Window(now,1):new Window(old.start(),old.count()+1));
        if(window.count()>20) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Trop de tentatives. Réessayez dans une minute.");
    }
}
