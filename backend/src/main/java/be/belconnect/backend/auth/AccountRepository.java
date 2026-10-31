package be.belconnect.backend.auth;

import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AccountRepository {
    private final JdbcTemplate jdbc;
    public AccountRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Profile(long id, String firstName, String lastName, String email, String avatarCode) {}
    public record Account(Profile profile, String passwordHash, String status) {}
    public Optional<Account> findByEmail(String email) {
        return jdbc.query("SELECT id, prenom, nom, email, avatar_code, mot_de_passe_hash, statut FROM utilisateur WHERE email = ?",
                (row, index) -> new Account(new Profile(row.getLong("id"), row.getString("prenom"), row.getString("nom"), row.getString("email"), row.getString("avatar_code")), row.getString("mot_de_passe_hash"), row.getString("statut")), email).stream().findFirst();
    }
    public Profile create(String firstName, String lastName, String email, String hash) {
        return jdbc.queryForObject("INSERT INTO utilisateur (prenom, nom, email, mot_de_passe_hash) VALUES (?, ?, ?, ?) RETURNING id, prenom, nom, email, avatar_code",
                (row, index) -> new Profile(row.getLong("id"), row.getString("prenom"), row.getString("nom"), row.getString("email"), row.getString("avatar_code")), firstName, lastName, email, hash);
    }
    public Optional<Profile> updateName(String email, String firstName, String lastName) {
        return jdbc.query("UPDATE utilisateur SET prenom=?, nom=? WHERE email=? AND statut='ACTIF' RETURNING id, prenom, nom, email, avatar_code",
                (row, index) -> new Profile(row.getLong("id"), row.getString("prenom"), row.getString("nom"), row.getString("email"), row.getString("avatar_code")), firstName, lastName, email).stream().findFirst();
    }
    public Optional<Profile> updateAvatar(String email, String avatarCode) {
        return jdbc.query("UPDATE utilisateur SET avatar_code=? WHERE email=? AND statut='ACTIF' RETURNING id, prenom, nom, email, avatar_code",
                (row, index) -> new Profile(row.getLong("id"), row.getString("prenom"), row.getString("nom"), row.getString("email"), row.getString("avatar_code")), avatarCode, email).stream().findFirst();
    }
}
