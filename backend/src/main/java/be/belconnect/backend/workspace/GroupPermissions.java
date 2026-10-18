package be.belconnect.backend.workspace;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class GroupPermissions {
    private final JdbcTemplate jdbc;
    public GroupPermissions(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    // Caller locks the space before writes. The membership and group locks keep revocation atomic.
    public boolean canDecide(long actor,long space,long group) {
        var admins=jdbc.query("""
            SELECT id FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?
              AND statut='ACTIF' AND role='ADMINISTRATEUR' FOR SHARE
            """,(r,n)->r.getLong(1),actor,space);
        if(!admins.isEmpty()) return true;
        return !jdbc.query("""
            SELECT ag.groupe_id FROM appartenance_groupe ag
            JOIN appartenance_espace a ON a.utilisateur_id=ag.utilisateur_id AND a.espace_id=ag.espace_id
            JOIN groupe g ON g.id=ag.groupe_id AND g.espace_id=ag.espace_id
            WHERE ag.utilisateur_id=? AND ag.espace_id=? AND ag.groupe_id=?
              AND ag.statut='ACTIF' AND ag.role='REFERENT' AND a.statut='ACTIF'
              AND g.statut='ACTIF' AND g.referents_gerent_adhesions
            FOR SHARE OF ag,a,g
            """,(r,n)->r.getLong(1),actor,space,group).isEmpty();
    }
}
