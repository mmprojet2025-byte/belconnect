package be.belconnect.backend.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace")
public class SpaceManagementController {
    private final JdbcTemplate jdbc;
    public SpaceManagementController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record SpaceContent(@NotBlank @Size(min=3,max=180) String name,
        @NotNull @Pattern(regexp="ASSOCIATION|PARTICULIER|ORGANISATEUR") String type,
        @NotNull @Size(max=3000) String description) {
        public SpaceContent { name=clean(name); description=clean(description); }
    }
    public record Opening(@NotNull UUID requestId,@NotNull @Valid SpaceContent content) {}
    public record Decision(@NotNull @Min(0) Long version,
        @NotNull @Pattern(regexp="APPROUVEE|REFUSEE") String status,@NotNull @Size(max=1000) String reason) {
        public Decision { reason=clean(reason); }
    }
    public record SpaceUpdate(@NotNull @Min(0) Long version,@NotNull @Valid SpaceContent content) {}
    public record GroupContent(@NotBlank @Size(min=3,max=150) String name,@NotNull @Size(max=3000) String description,
        @NotNull @Size(max=2048) String coverUrl,@NotNull Boolean openMembership,
        @NotNull @Pattern(regexp="PUBLIQUE|PRIVEE") String visibility) {
        public GroupContent { name=clean(name); description=clean(description); coverUrl=clean(coverUrl); }
    }
    public record GroupCreation(@NotNull UUID requestId,@NotNull @Valid GroupContent content) {}
    public record GroupUpdate(@NotNull @Min(0) Long version,@NotNull @Valid GroupContent content) {}
    public record Space(long id,String name,String type,String description,long version) {}
    public record Group(long id,long spaceId,String name,String description,String coverUrl,boolean openMembership,
                        String visibility,String status,long version) {}
    public record Management(Space space,List<Group> groups) {}
    public record Request(long id,String name,String type,String description,String status,long version,
                          Long spaceId,String reason,String applicant,OffsetDateTime createdAt) {}
    static String clean(String value) { return value==null?null:value.strip(); }
    private ResponseStatusException error(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
    private long user(Authentication auth) {
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF' FOR SHARE",
            (r,n)->r.getLong(1),auth.getName()).stream().findFirst()
            .orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    private void owner(long user) {
        if(jdbc.query("SELECT utilisateur_id FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE' FOR SHARE",
            (r,n)->r.getLong(1),user).isEmpty()) throw error(HttpStatus.FORBIDDEN,"Cette action est réservée au propriétaire de Belconnect.");
    }
    private void admin(long user,long space,boolean write) {
        // Lock the space first on writes, avoiding lock upgrades and serializing edits in one space.
        if(jdbc.query("SELECT id FROM espace_organisateur WHERE id=? AND statut='ACTIF'"+(write?" FOR UPDATE":""),
            (r,n)->r.getLong(1),space).isEmpty()) throw error(HttpStatus.FORBIDDEN,"Cet espace n’est pas accessible à la gestion.");
        if(jdbc.query("""
            SELECT id FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?
            AND role='ADMINISTRATEUR' AND statut='ACTIF'
            """+(write?" FOR SHARE":""),(r,n)->r.getLong(1),user,space).isEmpty())
            throw error(HttpStatus.FORBIDDEN,"Seul un administrateur actif de cet espace peut le gérer.");
    }
    private List<Request> requests(String where,Object... args) {
        return jdbc.query("""
            SELECT d.*,u.prenom,u.nom AS demandeur_nom FROM demande_espace d
            JOIN utilisateur u ON u.id=d.demandeur_id
            """+where+" ORDER BY d.date_creation DESC,d.id DESC",(r,n)->new Request(r.getLong("id"),r.getString("nom"),
            r.getString("type"),r.getString("description"),r.getString("statut"),r.getLong("version"),r.getObject("espace_id",Long.class),
            r.getString("motif"),r.getString("prenom")+" "+r.getString("demandeur_nom"),r.getObject("date_creation",OffsetDateTime.class)),args);
    }
    private Request request(long id) { return requests("WHERE d.id=?",id).getFirst(); }
    @GetMapping("/requests") @Transactional
    public List<Request> mine(Authentication auth) { return requests("WHERE d.demandeur_id=?",user(auth)); }
    @PostMapping("/requests") @Transactional @ResponseStatus(HttpStatus.CREATED)
    public Request requestOpening(Authentication auth,@Valid @RequestBody Opening body) {
        long user=user(auth); var c=body.content();
        var ids=jdbc.query("""
            INSERT INTO demande_espace(demandeur_id,creation_request,nom,type,description) VALUES (?,?,?,?,?)
            ON CONFLICT(demandeur_id,creation_request) DO NOTHING RETURNING id
            """,(r,n)->r.getLong(1),user,body.requestId(),c.name(),c.type(),c.description());
        long id=ids.isEmpty()?jdbc.queryForObject("SELECT id FROM demande_espace WHERE demandeur_id=? AND creation_request=?",Long.class,user,body.requestId()):ids.getFirst();
        var result=request(id);
        if(!result.name().equals(c.name()) || !result.type().equals(c.type()) || !result.description().equals(c.description()))
            throw error(HttpStatus.CONFLICT,"Cette demande a déjà été envoyée avec un autre contenu. Actualisez vos demandes.");
        return result;
    }
    @GetMapping("/opening-requests") @Transactional
    public List<Request> queue(Authentication auth) { owner(user(auth)); return requests(""); }
    @PostMapping("/opening-requests/{id}/decision") @Transactional
    public Request decide(Authentication auth,@PathVariable long id,@Valid @RequestBody Decision body) {
        long user=user(auth); owner(user);
        if(body.status().equals("REFUSEE") && body.reason().isBlank()) throw error(HttpStatus.BAD_REQUEST,"Indiquez le motif du refus.");
        var ids=jdbc.query("SELECT id FROM demande_espace WHERE id=? FOR UPDATE",(r,n)->r.getLong(1),id);
        if(ids.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Demande introuvable.");
        var d=request(id);
        var row=jdbc.queryForMap("SELECT demandeur_id,examinateur_id FROM demande_espace WHERE id=?",id);
        if(!d.status().equals("EN_ATTENTE")) {
            if(d.version()==body.version()+1 && d.status().equals(body.status()) && d.reason().equals(body.reason())
                && Objects.equals(row.get("examinateur_id"),user)) return d;
            throw error(HttpStatus.CONFLICT,"Cette demande a déjà été traitée. Actualisez la liste.");
        }
        if(d.version()!=body.version()) throw error(HttpStatus.CONFLICT,"La demande a changé. Actualisez la liste.");
        Long space=null;
        if(body.status().equals("APPROUVEE")) {
            long applicant=((Number)row.get("demandeur_id")).longValue();
            if(jdbc.query("SELECT id FROM utilisateur WHERE id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),applicant).isEmpty())
                throw error(HttpStatus.CONFLICT,"Le compte du demandeur n’est plus actif.");
            if(Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",
                Boolean.class,applicant)))
                throw error(HttpStatus.CONFLICT,"Le propriétaire de Belconnect ne peut pas administrer un espace organisateur.");
            space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,description,createur_id) VALUES (?,?,?,?) RETURNING id",
                Long.class,d.name(),d.type(),d.description(),applicant);
            jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",applicant,space);
            audit(space,null,user,"OUVERTURE_APPROUVEE",0);
        }
        jdbc.update("UPDATE demande_espace SET statut=?,espace_id=?,examinateur_id=?,motif=?,date_decision=now(),version=version+1 WHERE id=?",
            body.status(),space,user,body.reason(),id);
        return request(id);
    }
    private Space space(long id) {
        return jdbc.query("SELECT * FROM espace_organisateur WHERE id=?",(r,n)->new Space(r.getLong("id"),r.getString("nom"),
            r.getString("type"),r.getString("description"),r.getLong("version")),id).getFirst();
    }
    private List<Group> groups(long space) {
        return jdbc.query("SELECT * FROM groupe WHERE espace_id=? ORDER BY nom,id",(r,n)->new Group(r.getLong("id"),r.getLong("espace_id"),
            r.getString("nom"),Objects.requireNonNullElse(r.getString("description"),""),r.getString("couverture_url"),r.getBoolean("adhesion_ouverte"),
            r.getString("visibilite"),r.getString("statut"),r.getLong("version")),space);
    }
    private Group group(long space,long id) {
        return groups(space).stream().filter(g->g.id()==id).findFirst().orElseThrow(()->error(HttpStatus.NOT_FOUND,"Groupe introuvable dans cet espace."));
    }
    private void audit(long space,Long group,long actor,String action,long version) {
        jdbc.update("INSERT INTO historique_gestion_espace(espace_id,groupe_id,acteur_id,action,version) VALUES (?,?,?,?,?)",space,group,actor,action,version);
    }
    @GetMapping("/spaces/{id}/management") @Transactional
    public Management manage(Authentication auth,@PathVariable long id) {
        admin(user(auth),id,false); return new Management(space(id),groups(id));
    }
    @PostMapping("/spaces/{id}") @Transactional
    public Space updateSpace(Authentication auth,@PathVariable long id,@Valid @RequestBody SpaceUpdate body) {
        long user=user(auth); admin(user,id,true); var c=body.content();
        if(jdbc.update("UPDATE espace_organisateur SET nom=?,type=?,description=?,version=version+1 WHERE id=? AND version=?",
            c.name(),c.type(),c.description(),id,body.version())!=1) throw error(HttpStatus.CONFLICT,"L’espace a changé. Rechargez les données avant de modifier.");
        audit(id,null,user,"ESPACE_MODIFIE",body.version()+1); return space(id);
    }
    private void cover(GroupContent c) {
        if(c.coverUrl().isEmpty()) return;
        try { var url=URI.create(c.coverUrl());
            if(!"https".equalsIgnoreCase(url.getScheme()) || url.getHost()==null || url.getUserInfo()!=null) throw new IllegalArgumentException();
        } catch(IllegalArgumentException e) { throw error(HttpStatus.BAD_REQUEST,"La couverture doit être une adresse HTTPS valide, sans identifiants."); }
    }
    private void uniqueName(long space,Long group,String name) {
        if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM groupe WHERE espace_id=? AND nom=? AND (?::bigint IS NULL OR id<>?))",
            Boolean.class,space,name,group,group))) throw error(HttpStatus.CONFLICT,"Un groupe porte déjà ce nom dans cet espace.");
    }
    @PostMapping("/spaces/{spaceId}/groups") @Transactional @ResponseStatus(HttpStatus.CREATED)
    public Group createGroup(Authentication auth,@PathVariable long spaceId,@Valid @RequestBody GroupCreation body) {
        long user=user(auth); admin(user,spaceId,true); var c=body.content(); cover(c);
        var prior=jdbc.queryForList("SELECT id,createur_id FROM groupe WHERE espace_id=? AND creation_request=?",spaceId,body.requestId());
        if(!prior.isEmpty()) {
            var g=group(spaceId,((Number)prior.getFirst().get("id")).longValue());
            if(Objects.equals(prior.getFirst().get("createur_id"),user) && g.version()==0 && g.name().equals(c.name()) && g.description().equals(c.description())
                && g.coverUrl().equals(c.coverUrl()) && g.openMembership()==c.openMembership() && g.visibility().equals(c.visibility())) return g;
            throw error(HttpStatus.CONFLICT,"Cette création a déjà été traitée. Rechargez les groupes.");
        }
        uniqueName(spaceId,null,c.name());
        long id=jdbc.queryForObject("""
            INSERT INTO groupe(espace_id,nom,description,couverture_url,adhesion_ouverte,visibilite,creation_request,createur_id)
            VALUES (?,?,?,?,?,?,?,?) RETURNING id
            """,Long.class,spaceId,c.name(),c.description(),c.coverUrl(),c.openMembership(),c.visibility(),body.requestId(),user);
        audit(spaceId,id,user,"GROUPE_CREE",0); return group(spaceId,id);
    }
    @PostMapping("/spaces/{spaceId}/groups/{id}") @Transactional
    public Group updateGroup(Authentication auth,@PathVariable long spaceId,@PathVariable long id,@Valid @RequestBody GroupUpdate body) {
        long user=user(auth); admin(user,spaceId,true); var c=body.content(); cover(c); var old=group(spaceId,id);
        if(!old.status().equals("ACTIF")) throw error(HttpStatus.CONFLICT,"Seuls les groupes actifs peuvent être modifiés ici.");
        uniqueName(spaceId,id,c.name());
        if(jdbc.update("""
            UPDATE groupe SET nom=?,description=?,couverture_url=?,adhesion_ouverte=?,visibilite=?,version=version+1
            WHERE id=? AND espace_id=? AND version=?
            """,c.name(),c.description(),c.coverUrl(),c.openMembership(),c.visibility(),id,spaceId,body.version())!=1)
            throw error(HttpStatus.CONFLICT,"Ce groupe a changé. Rechargez les données avant de modifier.");
        audit(spaceId,id,user,"GROUPE_MODIFIE",body.version()+1); return group(spaceId,id);
    }
    public record GroupStatus(@NotNull @Min(0) Long version,
        @NotNull @Pattern(regexp="ACTIF|SUSPENDU|ARCHIVE") String status) {}
    @PostMapping("/spaces/{spaceId}/groups/{id}/status") @Transactional
    public Group changeGroupStatus(Authentication auth,@PathVariable long spaceId,@PathVariable long id,
                                   @Valid @RequestBody GroupStatus body) {
        long actor=user(auth); admin(actor,spaceId,true); var old=group(spaceId,id);
        if(old.version()!=body.version()) throw error(HttpStatus.CONFLICT,"Ce groupe a changé. Actualisez les groupes avant de réessayer.");
        if(old.status().equals(body.status())) return old;
        if(old.status().equals("ARCHIVE")) throw error(HttpStatus.CONFLICT,"Un groupe archivé ne peut plus être réactivé ou suspendu.");
        jdbc.update("UPDATE groupe SET statut=?,version=version+1 WHERE id=? AND espace_id=? AND version=?",
            body.status(),id,spaceId,body.version());
        String action=switch(body.status()) { case "ACTIF" -> "GROUPE_REACTIVE"; case "SUSPENDU" -> "GROUPE_SUSPENDU"; default -> "GROUPE_ARCHIVE"; };
        audit(spaceId,id,actor,action,body.version()+1);
        return group(spaceId,id);
    }

}
