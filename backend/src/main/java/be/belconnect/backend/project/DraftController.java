package be.belconnect.backend.project;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.net.URI;
import java.util.List;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/project-drafts")
public class DraftController {
    private static final List<String> ALL_HELP_TYPES = List.of("BENEVOLAT", "COMPETENCES", "PARTAGE", "SOUTIEN_MORAL");
    private final JdbcTemplate jdbc;
    public DraftController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Content(@NotBlank @Size(min=5,max=180) String title,
            @NotNull @Size(max=10000) String description, @NotNull @Size(max=3000) String objective,
            LocalDate startsOn, LocalDate endsOn, @Size(max=2048) String imageUrl,
            @Size(min=1,max=4) List<@NotBlank @Pattern(regexp="BENEVOLAT|COMPETENCES|PARTAGE|SOUTIEN_MORAL") String> helpTypes,
            @Pattern(regexp="PUBLIQUE|GROUPE") String visibility) {
        public Content {
            title = title == null ? null : title.strip();
            description = description == null ? null : description.strip();
            objective = objective == null ? null : objective.strip();
            imageUrl = imageUrl == null || imageUrl.isBlank() ? null : imageUrl.strip();
            helpTypes = helpTypes == null ? ALL_HELP_TYPES : new ArrayList<>(helpTypes);
            visibility = visibility == null ? "PUBLIQUE" : visibility;
        }
    }
    public record Creation(@NotNull @Positive Long spaceId, @Positive Long groupId,
            @NotNull UUID requestId, @NotNull @Valid Content content) {}
    public record Update(@NotNull @Min(0) Long version, @NotNull @Valid Content content) {}
    public record Draft(long id, long spaceId, Long groupId, String spaceName, String groupName,
            String title, String description, String objective, LocalDate startsOn, LocalDate endsOn, String imageUrl, List<String> helpTypes, String visibility, long version, String status, java.util.List<Review> reviews) {}
    public record Review(String decision,String comment,String reviewer,java.time.OffsetDateTime date) {}
    private long user(Authentication auth) {
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF' FOR SHARE",
            (r,n)->r.getLong(1), auth.getName()).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    private void access(long userId, long spaceId, Long groupId) {
        if(jdbc.query("""
            SELECT a.id FROM appartenance_espace a JOIN espace_organisateur e ON e.id=a.espace_id
            WHERE a.utilisateur_id=? AND e.id=? AND a.statut='ACTIF' AND e.statut='ACTIF' FOR SHARE OF a,e
            """,(r,n)->r.getLong(1),userId,spaceId).isEmpty())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Vous devez être membre actif de cet espace pour enregistrer un projet.");
        if(groupId != null && jdbc.query("""
            SELECT g.id FROM groupe g JOIN appartenance_espace ae ON ae.espace_id=g.espace_id
            WHERE ae.utilisateur_id=? AND g.id=? AND g.espace_id=? AND ae.statut='ACTIF' AND g.statut='ACTIF'
              AND (ae.role='ADMINISTRATEUR' OR EXISTS(SELECT 1 FROM appartenance_groupe ag
                WHERE ag.groupe_id=g.id AND ag.espace_id=g.espace_id AND ag.utilisateur_id=ae.utilisateur_id AND ag.statut='ACTIF' FOR SHARE OF ag))
            FOR SHARE OF ae,g
            """,(r,n)->r.getLong(1),userId,groupId,spaceId).isEmpty())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Vous devez être membre actif du groupe choisi dans cet espace.");
    }
    private void dates(Content c) {
        if(c.startsOn()!=null && c.endsOn()!=null && c.endsOn().isBefore(c.startsOn()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"La fin prévue doit être après le début prévu.");
    }
    private void image(Content c) {
        if (c.imageUrl() == null) return;
        try {
            URI uri = URI.create(c.imageUrl());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Indiquez une adresse d'image HTTPS valide.");
        }
    }
    private void helpTypes(Content c) {
        if (new HashSet<>(c.helpTypes()).size() != c.helpTypes().size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choisissez chaque type d'aide une seule fois.");
    }
    private void visibility(Content c, Long groupId) {
        if ("GROUPE".equals(c.visibility()) && groupId == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choisissez un groupe pour réserver ce projet à ses membres.");
    }
    private Draft read(long id, long userId) {
        return jdbc.query("""
            SELECT p.*, e.nom AS espace_nom, g.nom AS groupe_nom FROM projet p
            JOIN espace_organisateur e ON e.id=p.espace_id LEFT JOIN groupe g ON g.id=p.groupe_id
            WHERE p.id=? AND p.auteur_id=? AND p.statut IN ('BROUILLON','A_CORRIGER')
            """,(r,n)->new Draft(r.getLong("id"),r.getLong("espace_id"),r.getObject("groupe_id",Long.class),
                r.getString("espace_nom"),r.getString("groupe_nom"),r.getString("titre"),r.getString("description"),
                r.getString("objectif"),r.getObject("debut_prevu",LocalDate.class),r.getObject("fin_prevue",LocalDate.class),r.getString("image_url"),List.of((String[])r.getArray("types_aide").getArray()),r.getString("visibilite"),r.getLong("version"),r.getString("statut"),reviews(id)),id,userId)
            .stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Brouillon introuvable."));
    }
    private java.util.List<Review> reviews(long id) {
        return jdbc.query("""
            SELECT v.decision,v.commentaire,u.prenom,u.nom,v.date_decision FROM validation_projet v
            JOIN utilisateur u ON u.id=v.examinateur_id WHERE v.projet_id=? ORDER BY v.date_decision,v.id
            """,(r,n)->new Review(r.getString("decision"),r.getString("commentaire"),r.getString("prenom")+" "+r.getString("nom"),r.getObject("date_decision",java.time.OffsetDateTime.class)),id);
    }
    @GetMapping("/{id}") @Transactional
    public Draft get(Authentication auth,@PathVariable long id) { return read(id,user(auth)); }

    @PostMapping @Transactional @ResponseStatus(HttpStatus.CREATED)
    public Draft create(Authentication auth,@Valid @RequestBody Creation body) {
        long userId=user(auth); access(userId,body.spaceId(),body.groupId()); dates(body.content()); image(body.content()); helpTypes(body.content()); visibility(body.content(),body.groupId());
        var c=body.content();
        var ids=jdbc.query("""
            INSERT INTO projet(espace_id,groupe_id,auteur_id,titre,description,objectif,debut_prevu,fin_prevue,image_url,types_aide,visibilite,creation_request)
            VALUES (?,?,?,?,?,?,?,?,?,string_to_array(?,','),?,?) ON CONFLICT (auteur_id,creation_request) DO NOTHING RETURNING id
            """,(r,n)->r.getLong(1),body.spaceId(),body.groupId(),userId,c.title(),c.description(),c.objective(),c.startsOn(),c.endsOn(),c.imageUrl(),String.join(",",c.helpTypes()),c.visibility(),body.requestId());
        long id=ids.isEmpty()?jdbc.queryForObject("SELECT id FROM projet WHERE auteur_id=? AND creation_request=?",Long.class,userId,body.requestId()):ids.getFirst();
        // A retry retrieves the original draft instead of creating a duplicate.
        var draft=read(id,userId);
        if(ids.isEmpty() && (draft.spaceId()!=body.spaceId() || !java.util.Objects.equals(draft.groupId(),body.groupId())
                || !draft.title().equals(c.title()) || !draft.description().equals(c.description()) || !draft.objective().equals(c.objective())
                || !java.util.Objects.equals(draft.startsOn(),c.startsOn()) || !java.util.Objects.equals(draft.endsOn(),c.endsOn())
                || !java.util.Objects.equals(draft.imageUrl(),c.imageUrl()) || !draft.helpTypes().equals(c.helpTypes()) || !draft.visibility().equals(c.visibility())))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Un brouillon a déjà été enregistré avec cette demande. Fermez ce formulaire et actualisez vos projets pour le rouvrir.");
        return draft;
    }
    @PostMapping("/{id}") @Transactional
    public Draft update(Authentication auth,@PathVariable long id,@Valid @RequestBody Update body) {
        long userId=user(auth);
        var draft=read(id,userId); access(userId,draft.spaceId(),draft.groupId()); dates(body.content()); image(body.content()); helpTypes(body.content()); visibility(body.content(),draft.groupId());
        var c=body.content();
        int changed=jdbc.update("""
            UPDATE projet SET titre=?,description=?,objectif=?,debut_prevu=?,fin_prevue=?,image_url=?,types_aide=string_to_array(?,','),visibilite=?,version=version+1,date_modification=now()
            WHERE id=? AND auteur_id=? AND statut IN ('BROUILLON','A_CORRIGER') AND version=?
            """,c.title(),c.description(),c.objective(),c.startsOn(),c.endsOn(),c.imageUrl(),String.join(",",c.helpTypes()),c.visibility(),id,userId,body.version());
        if(changed!=1) throw new ResponseStatusException(HttpStatus.CONFLICT,"Ce projet a changé. Rechargez le brouillon avant de réessayer.");
        return read(id,userId);
    }
    public record SubmissionRequest(@NotNull @Min(0) Long version) {}
    public record Submission(long id, String title, long spaceId, String spaceName, String status, String reviewStage, boolean published) {}
    @PostMapping("/{id}/submit") @Transactional
    public Submission submit(Authentication auth, @PathVariable long id, @Valid @RequestBody SubmissionRequest body) {
        long userId=user(auth);
        // Membership locks use the same order as draft edits; the project update is version-checked below.
        var rows=jdbc.queryForList("SELECT * FROM projet WHERE id=? AND auteur_id=?",id,userId);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet introuvable.");
        var row=rows.getFirst(); long spaceId=((Number)row.get("espace_id")).longValue();
        Long groupId=row.get("groupe_id")==null?null:((Number)row.get("groupe_id")).longValue();
        access(userId,spaceId,groupId);
        // Serialize this author's submissions so concurrent requests cannot bypass the pending-project limit.
        jdbc.query("SELECT pg_advisory_xact_lock(?)",(r,n)->0,8_400_000_000L+userId);
        // Lock the project after memberships, serializing retries and concurrent submissions.
        row=jdbc.queryForMap("SELECT * FROM projet WHERE id=? FOR UPDATE",id);
        String spaceName=jdbc.queryForObject("SELECT nom FROM espace_organisateur WHERE id=?",String.class,spaceId);
        if("SOUMIS".equals(row.get("statut")) && jdbc.queryForObject(
                "SELECT count(*) FROM soumission_projet WHERE projet_id=? AND auteur_id=? AND version_brouillon=?",Integer.class,id,userId,body.version())==1)
            return new Submission(id,(String)row.get("titre"),spaceId,spaceName,"SOUMIS",(String)row.get("etape_validation"),false);
        if(!java.util.List.of("BROUILLON","A_CORRIGER").contains(row.get("statut")) || ((Number)row.get("version")).longValue()!=body.version())
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Ce projet a changé. Fermez puis rouvrez le brouillon avant de le soumettre.");
        if(((String)row.get("description")).isBlank() || ((String)row.get("objectif")).isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Complétez et enregistrez la description et l’objectif avant de soumettre le projet.");
        var referents=groupId==null?java.util.List.<Long>of():jdbc.query("""
            SELECT u.id FROM appartenance_groupe ag
            JOIN appartenance_espace ae ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
            JOIN utilisateur u ON u.id=ag.utilisateur_id
            WHERE ag.groupe_id=? AND ag.espace_id=? AND ag.role='REFERENT' AND ag.statut='ACTIF'
              AND ae.statut='ACTIF' AND u.statut='ACTIF' AND u.id<>?
            FOR SHARE OF ag,ae,u
            """,(r,n)->r.getLong(1),groupId,spaceId,userId);
        boolean soleAdministrator=Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM appartenance_espace ae WHERE ae.espace_id=? AND ae.utilisateur_id=?
              AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF')
              AND NOT EXISTS(SELECT 1 FROM appartenance_espace ae JOIN utilisateur u ON u.id=ae.utilisateur_id
                WHERE ae.espace_id=? AND ae.utilisateur_id<>? AND ae.role='ADMINISTRATEUR'
                  AND ae.statut='ACTIF' AND u.statut='ACTIF')
            """,Boolean.class,spaceId,userId,spaceId,userId));
        if(soleAdministrator) {
            jdbc.update("UPDATE projet SET statut='APPROUVE',etape_validation=NULL,date_soumission=now(),date_modification=now(),version=version+1 WHERE id=?",id);
            jdbc.update("INSERT INTO soumission_projet(projet_id,auteur_id,version_brouillon,destination) VALUES (?,?,?,'ADMINISTRATEUR')",id,userId,body.version());
            jdbc.update("INSERT INTO validation_projet(projet_id,examinateur_id,decision,commentaire,version_projet) VALUES (?,?,'APPROUVE','Approbation automatique : administrateur unique de l’espace.',?)",id,userId,body.version()+1);
            return new Submission(id,(String)row.get("titre"),spaceId,spaceName,"APPROUVE",null,false);
        }
        if(jdbc.queryForObject("SELECT count(*) FROM projet WHERE auteur_id=? AND statut='SOUMIS' AND id<>?",Integer.class,userId,id)>=3)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Vous avez déjà trois projets en attente. Attendez une décision avant d’en soumettre un autre.");
        String stage=referents.isEmpty()?"ADMINISTRATEUR":"REFERENT";
        jdbc.update("UPDATE projet SET statut='SOUMIS',etape_validation=?,date_soumission=now(),date_modification=now(),version=version+1 WHERE id=?",stage,id);
        jdbc.update("INSERT INTO soumission_projet(projet_id,auteur_id,version_brouillon,destination) VALUES (?,?,?,?)",id,userId,body.version(),stage);
        return new Submission(id,(String)row.get("titre"),spaceId,spaceName,"SOUMIS",stage,false);
    }

}
