package be.belconnect.backend.workspace;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class GroupMembershipLimit {
    private final JdbcTemplate jdbc;

    public GroupMembershipLimit(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void check(long userId, long groupId) {
        // Serialize joins for the same account, including joins in different spaces.
        jdbc.queryForObject("SELECT id FROM utilisateur WHERE id=? FOR UPDATE", Long.class, userId);
        int count = jdbc.queryForObject("""
            SELECT count(*) FROM appartenance_groupe a
            JOIN groupe g ON g.id=a.groupe_id
            WHERE a.utilisateur_id=? AND a.groupe_id<>?
              AND a.statut<>'RETIRE' AND g.statut<>'ARCHIVE'
            """, Integer.class, userId, groupId);
        if (count >= 2) throw new ResponseStatusException(HttpStatus.CONFLICT,
            "Vous êtes déjà membre de deux groupes. Vous ne pouvez pas en rejoindre un troisième.");
    }
}
