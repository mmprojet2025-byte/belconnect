package be.belconnect.backend.activity;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ActivityAccess {
    private final JdbcTemplate jdbc;
    public ActivityAccess(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    // Same predicate for catalogue, direct detail and reservation. Existing demo rows have no space.
    public static final String VISIBLE = """
      a.publiee AND NOT a.annulee AND NOT a.masquee_moderation AND (a.espace_id IS NULL OR EXISTS (SELECT 1 FROM espace_organisateur e WHERE e.id=a.espace_id AND e.statut='ACTIF'))
      AND (a.groupe_id IS NULL OR EXISTS (SELECT 1 FROM groupe g WHERE g.id=a.groupe_id AND g.espace_id=a.espace_id AND g.statut='ACTIF'))
      AND (a.visibilite='PUBLIQUE' OR EXISTS (
        SELECT 1 FROM appartenance_espace ae JOIN utilisateur u ON u.id=ae.utilisateur_id
        WHERE ae.espace_id=a.espace_id AND ae.utilisateur_id=? AND ae.statut='ACTIF' AND u.statut='ACTIF'
        AND (ae.role='ADMINISTRATEUR' OR a.groupe_id IS NULL OR EXISTS (
          SELECT 1 FROM appartenance_groupe ag WHERE ag.groupe_id=a.groupe_id AND ag.espace_id=a.espace_id
          AND ag.utilisateur_id=ae.utilisateur_id AND ag.statut='ACTIF'))))
      """;
    public void lockAndCheck(long id,long user) {
        var rows=jdbc.queryForList("SELECT espace_id,groupe_id FROM activite WHERE id=?",id);
        if(rows.isEmpty()) throw missing();
        var row=rows.getFirst();
        if(row.get("espace_id")!=null) jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? FOR SHARE",row.get("espace_id"));
        if(row.get("groupe_id")!=null) jdbc.queryForList("SELECT id FROM groupe WHERE id=? FOR SHARE",row.get("groupe_id"));
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM activite a WHERE a.id=? AND "+VISIBLE+")",Boolean.class,id,user))) throw missing();
    }
    private ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND,"Activité indisponible."); }
}
