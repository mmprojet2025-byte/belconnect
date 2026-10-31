package be.belconnect.backend.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MobileTokenService {
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();
    public MobileTokenService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public String issue(AccountRepository.Account account) {
        jdbc.update("DELETE FROM session_mobile WHERE date_expiration<=now()");
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("""
            INSERT INTO session_mobile(jeton_hash,utilisateur_id,empreinte_identifiants,date_expiration)
            VALUES (?,?,?,now()+interval '30 days')
            """, hash(token), account.profile().id(), account.passwordHash());
        return token;
    }

    public AccountRepository.Profile authenticate(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) return null;
        return jdbc.query("""
            SELECT u.id,u.prenom,u.nom,u.email,u.avatar_code
            FROM session_mobile s JOIN utilisateur u ON u.id=s.utilisateur_id
            WHERE s.jeton_hash=? AND s.date_expiration>now() AND u.statut='ACTIF'
              AND s.empreinte_identifiants=u.mot_de_passe_hash
            """, (row,index) -> new AccountRepository.Profile(row.getLong("id"),row.getString("prenom"),row.getString("nom"),row.getString("email"),row.getString("avatar_code")), hash(token)).stream().findFirst().orElse(null);
    }

    public void revoke(String token) { if (token != null) jdbc.update("DELETE FROM session_mobile WHERE jeton_hash=?", hash(token)); }

    static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII))); }
        catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
}
