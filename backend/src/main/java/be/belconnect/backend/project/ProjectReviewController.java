package be.belconnect.backend.project;

import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/project-reviews")
public class ProjectReviewController {
    private final JdbcTemplate jdbc;
    public ProjectReviewController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Project(long id,String title,String description,String objective,long spaceId,String spaceName,String groupName,
                          String reviewStage,OffsetDateTime submittedAt,LocalDate startsOn,LocalDate endsOn,long version,boolean canReview,boolean canDecide,String status,List<DraftController.Review> reviews) {}
    private long user(Authentication auth) {
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName())
            .stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    // The role is checked against the database on every request, never trusted from the client.
    private static final String VISIBLE = """
        EXISTS (SELECT 1 FROM appartenance_espace ae
            WHERE ae.espace_id=p.espace_id AND ae.utilisateur_id=? AND ae.statut='ACTIF'
              AND e.statut='ACTIF' AND (p.groupe_id IS NULL OR g.statut='ACTIF')
              AND ((ae.role='ADMINISTRATEUR')
                OR (p.etape_validation='REFERENT' AND EXISTS (SELECT 1 FROM appartenance_groupe ag
                    WHERE ag.utilisateur_id=ae.utilisateur_id AND ag.espace_id=p.espace_id AND ag.groupe_id=p.groupe_id
                      AND ag.role='REFERENT' AND ag.statut='ACTIF'))))
        """;
    private static final String SELECT = """
        SELECT p.*,e.nom AS espace_nom,g.nom AS groupe_nom,
          (p.auteur_id<>? AND p.statut='SOUMIS' AND p.etape_validation='REFERENT' AND e.statut='ACTIF' AND g.statut='ACTIF'
           AND EXISTS (SELECT 1 FROM appartenance_groupe ag JOIN appartenance_espace ae
             ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
             WHERE ag.utilisateur_id=? AND ag.groupe_id=p.groupe_id AND ag.espace_id=p.espace_id
               AND ag.role='REFERENT' AND ag.statut='ACTIF' AND ae.statut='ACTIF')) AS can_review,
          ((p.auteur_id<>? OR NOT EXISTS (
             SELECT 1 FROM appartenance_espace other_admin JOIN utilisateur other_user ON other_user.id=other_admin.utilisateur_id
             WHERE other_admin.espace_id=p.espace_id AND other_admin.utilisateur_id<>p.auteur_id
               AND other_admin.role='ADMINISTRATEUR' AND other_admin.statut='ACTIF' AND other_user.statut='ACTIF'))
           AND p.statut='SOUMIS' AND e.statut='ACTIF'
           AND (p.groupe_id IS NULL OR g.statut='ACTIF')
           AND EXISTS (SELECT 1 FROM appartenance_espace ae WHERE ae.utilisateur_id=?
             AND ae.espace_id=p.espace_id AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF')) AS can_decide
        FROM projet p
        JOIN espace_organisateur e ON e.id=p.espace_id LEFT JOIN groupe g ON g.id=p.groupe_id
        WHERE p.statut IN ('SOUMIS','APPROUVE','REFUSE')
        """;
    private final org.springframework.jdbc.core.RowMapper<Project> mapper=(r,n)->new Project(r.getLong("id"),r.getString("titre"),
        r.getString("description"),r.getString("objectif"),r.getLong("espace_id"),r.getString("espace_nom"),r.getString("groupe_nom"),
        r.getString("etape_validation"),r.getObject("date_soumission",OffsetDateTime.class),r.getObject("debut_prevu",LocalDate.class),r.getObject("fin_prevue",LocalDate.class),r.getLong("version"),r.getBoolean("can_review"),r.getBoolean("can_decide"),r.getString("statut"),reviews(r.getLong("id")));
    private List<DraftController.Review> reviews(long id) {
        return jdbc.query("""
            SELECT v.decision,v.commentaire,u.prenom,u.nom,v.date_decision FROM validation_projet v
            JOIN utilisateur u ON u.id=v.examinateur_id WHERE v.projet_id=? ORDER BY v.date_decision,v.id
            """,(r,n)->new DraftController.Review(r.getString("decision"),r.getString("commentaire"),r.getString("prenom")+" "+r.getString("nom"),r.getObject("date_decision",OffsetDateTime.class)),id);
    }
    @GetMapping @Transactional(readOnly=true)
    public List<Project> inbox(Authentication auth) {
        long uid=user(auth);
        return jdbc.query(SELECT+" AND p.statut='SOUMIS' AND (p.auteur_id<>? OR NOT EXISTS (SELECT 1 FROM appartenance_espace other_admin JOIN utilisateur other_user ON other_user.id=other_admin.utilisateur_id WHERE other_admin.espace_id=p.espace_id AND other_admin.utilisateur_id<>p.auteur_id AND other_admin.role='ADMINISTRATEUR' AND other_admin.statut='ACTIF' AND other_user.statut='ACTIF')) AND "+VISIBLE+" ORDER BY p.date_soumission,p.id",mapper,uid,uid,uid,uid,uid,uid);
    }
    @GetMapping("/{id}") @Transactional(readOnly=true)
    public Project detail(Authentication auth,@PathVariable long id) {
        long uid=user(auth);
        return jdbc.query(SELECT+" AND p.id=? AND (p.auteur_id=? OR "+VISIBLE+")",mapper,uid,uid,uid,uid,id,uid,uid).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet soumis introuvable."));
    }
    public record Opinion(@NotNull @Min(0) Long version,
            @NotBlank @Pattern(regexp="AVIS_FAVORABLE|A_CORRIGER") String decision,
            @Size(max=3000) String comment) {
        public Opinion { comment=comment==null?"":comment.strip(); }
    }
    public record Outcome(long id,String status,String reviewStage) {}
    @PostMapping("/{id}/opinion") @Transactional
    public Outcome opinion(Authentication auth,@PathVariable long id,@Valid @RequestBody Opinion body) {
        long uid=user(auth);
        var rows=jdbc.queryForList("SELECT * FROM projet WHERE id=?",id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet introuvable.");
        var p=rows.getFirst();
        if(((Number)p.get("auteur_id")).longValue()==uid)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Vous ne pouvez pas examiner votre propre projet.");
        // Recheck and lock the assigned role, its parent membership and the active account.
        if(jdbc.query("""
            SELECT ag.utilisateur_id FROM appartenance_groupe ag
            JOIN appartenance_espace ae ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
            JOIN espace_organisateur e ON e.id=ag.espace_id
            JOIN groupe g ON g.id=ag.groupe_id AND g.espace_id=ag.espace_id
            JOIN utilisateur u ON u.id=ag.utilisateur_id
            WHERE ag.utilisateur_id=? AND ag.groupe_id=? AND ag.espace_id=?
              AND ag.role='REFERENT' AND ag.statut='ACTIF' AND ae.statut='ACTIF'
              AND e.statut='ACTIF' AND g.statut='ACTIF' AND u.statut='ACTIF'
            FOR SHARE OF ag,ae,e,g,u
            """,(r,n)->r.getLong(1),uid,p.get("groupe_id"),p.get("espace_id")).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet introuvable dans vos groupes de référence.");
        p=jdbc.queryForMap("SELECT * FROM projet WHERE id=? FOR UPDATE",id);
        var previous=jdbc.queryForList("SELECT examinateur_id,decision,commentaire FROM validation_projet WHERE projet_id=? AND version_projet=?",id,body.version());
        if(!previous.isEmpty()) {
            var old=previous.getFirst();
            if(((Number)old.get("examinateur_id")).longValue()==uid && old.get("decision").equals(body.decision()) && old.get("commentaire").equals(body.comment()))
                return new Outcome(id,(String)p.get("statut"),(String)p.get("etape_validation"));
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Un avis a déjà été enregistré sur cette version. Actualisez les projets reçus.");
        }
        if(!"SOUMIS".equals(p.get("statut")))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet soumis introuvable.");
        if(!"REFERENT".equals(p.get("etape_validation")) || ((Number)p.get("version")).longValue()!=body.version())
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Ce dossier a changé. Actualisez les projets reçus avant de donner votre avis.");
        if("A_CORRIGER".equals(body.decision()) && body.comment().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Précisez les corrections attendues pour l’auteur.");
        boolean corrections="A_CORRIGER".equals(body.decision());
        String status=corrections?"A_CORRIGER":"SOUMIS";
        String stage=corrections?null:"ADMINISTRATEUR";
        jdbc.update("INSERT INTO validation_projet(projet_id,examinateur_id,decision,commentaire,version_projet) VALUES (?,?,?,?,?)",id,uid,body.decision(),body.comment(),body.version());
        jdbc.update("UPDATE projet SET statut=?,etape_validation=?,version=version+1,date_modification=now() WHERE id=?",status,stage,id);
        return new Outcome(id,status,stage);
    }

    public record Decision(@NotNull @Min(0) Long version,
            @NotBlank @Pattern(regexp="APPROUVE|REFUSE") String decision,
            @Size(max=3000) String comment) {
        public Decision { comment=comment==null?"":comment.strip(); }
    }
    @PostMapping("/{id}/decision") @Transactional
    public Outcome decide(Authentication auth,@PathVariable long id,@Valid @RequestBody Decision body) {
        long uid=user(auth);
        var rows=jdbc.queryForList("SELECT * FROM projet WHERE id=?",id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet introuvable.");
        var p=rows.getFirst();
        if(jdbc.query("""
            SELECT ae.utilisateur_id FROM appartenance_espace ae
            JOIN espace_organisateur e ON e.id=ae.espace_id
            JOIN utilisateur u ON u.id=ae.utilisateur_id
            WHERE ae.utilisateur_id=? AND ae.espace_id=? AND ae.role='ADMINISTRATEUR'
              AND ae.statut='ACTIF' AND e.statut='ACTIF' AND u.statut='ACTIF'
            FOR SHARE OF ae,e,u
            """,(r,n)->r.getLong(1),uid,p.get("espace_id")).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet introuvable dans vos espaces administrés.");
        if(((Number)p.get("auteur_id")).longValue()==uid && Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM appartenance_espace ae JOIN utilisateur u ON u.id=ae.utilisateur_id
              WHERE ae.espace_id=? AND ae.utilisateur_id<>? AND ae.role='ADMINISTRATEUR'
                AND ae.statut='ACTIF' AND u.statut='ACTIF')
            """,Boolean.class,p.get("espace_id"),uid)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Un autre administrateur actif peut examiner ce projet.");
        if(p.get("groupe_id")!=null && jdbc.query("SELECT id FROM groupe WHERE id=? AND statut='ACTIF' FOR SHARE",
            (r,n)->r.getLong(1),p.get("groupe_id")).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Groupe indisponible.");
        p=jdbc.queryForMap("SELECT * FROM projet WHERE id=? FOR UPDATE",id);
        var previous=jdbc.queryForList("SELECT examinateur_id,decision,commentaire FROM validation_projet WHERE projet_id=? AND version_projet=?",id,body.version());
        if(!previous.isEmpty()) {
            var old=previous.getFirst();
            if(((Number)old.get("examinateur_id")).longValue()==uid && old.get("decision").equals(body.decision()) && old.get("commentaire").equals(body.comment()))
                return new Outcome(id,(String)p.get("statut"),(String)p.get("etape_validation"));
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Un avis a déjà été enregistré sur cette version. Actualisez les projets reçus.");
        }
        if(!"SOUMIS".equals(p.get("statut")))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet soumis introuvable.");
        if(((Number)p.get("version")).longValue()!=body.version())
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Ce dossier a changé. Actualisez les projets reçus avant de donner votre avis.");
        if("REFUSE".equals(body.decision()) && body.comment().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Précisez le motif du refus pour l’auteur.");
        String status=body.decision();
        String stage=null;
        jdbc.update("INSERT INTO validation_projet(projet_id,examinateur_id,decision,commentaire,version_projet) VALUES (?,?,?,?,?)",id,uid,body.decision(),body.comment(),body.version());
        jdbc.update("UPDATE projet SET statut=?,etape_validation=?,version=version+1,date_modification=now() WHERE id=?",status,stage,id);
        return new Outcome(id,status,stage);
    }

}
