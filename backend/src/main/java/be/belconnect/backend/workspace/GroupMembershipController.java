package be.belconnect.backend.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class GroupMembershipController {
    private final JdbcTemplate jdbc;
    private final GroupPermissions permissions;
    public GroupMembershipController(JdbcTemplate jdbc,GroupPermissions permissions) { this.jdbc=jdbc; this.permissions=permissions; }
    public record Group(long id,String name,String description,String coverUrl,String spaceName,
                        boolean openMembership,String visibility,String membershipStatus) {}
    public record Request(long id,long groupId,String groupName,String spaceName,String applicant,
                          String status,String membershipStatus,String reason,long version,boolean available) {}
    public record Decision(@NotNull @Min(0) Long version,
                           @NotNull @Pattern(regexp="ACCEPTEE|REFUSEE") String status,
                           @NotNull @Size(max=1000) String reason) {
        public Decision { reason=reason==null?null:reason.strip(); }
    }
    private ResponseStatusException error(HttpStatus status,String reason) { return new ResponseStatusException(status,reason); }
    private long user(Authentication auth) {
        if(auth==null) throw error(HttpStatus.UNAUTHORIZED,"Connectez-vous pour rejoindre un groupe.");
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),auth.getName())
            .stream().findFirst().orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    private String membership(long user,long space,long group) {
        var a=jdbc.queryForList("SELECT role,statut FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?",user,space);
        if(!a.isEmpty() && !"ACTIF".equals(a.getFirst().get("statut"))) return "INDISPONIBLE";
        if(!a.isEmpty() && "ADMINISTRATEUR".equals(a.getFirst().get("role"))) return "ADMINISTRATEUR";
        var g=jdbc.queryForList("SELECT statut FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",user,group);
        if(!g.isEmpty()) return "ACTIF".equals(g.getFirst().get("statut")) && !a.isEmpty()?"MEMBRE":"INDISPONIBLE";
        return "AUCUNE";
    }
    private String state(long user,long space,long group) {
        String m=membership(user,space,group);
        if(!m.equals("AUCUNE")) return m;
        return jdbc.query("SELECT statut FROM demande_adhesion_groupe WHERE utilisateur_id=? AND groupe_id=?",(r,n)->r.getString(1),user,group)
            .stream().findFirst().orElse("AUCUNE");
    }
    @GetMapping("/groups") @Transactional
    public List<Group> catalogue(Authentication auth) {
        long user=auth==null?0:user(auth);
        return jdbc.query("""
            SELECT g.*,e.nom AS espace_nom FROM groupe g JOIN espace_organisateur e ON e.id=g.espace_id
            WHERE g.statut='ACTIF' AND e.statut='ACTIF' AND (g.visibilite='PUBLIQUE' OR EXISTS(
              SELECT 1 FROM appartenance_espace a WHERE a.espace_id=e.id AND a.utilisateur_id=? AND a.statut='ACTIF'))
            ORDER BY g.nom,g.id
            """,(r,n)->new Group(r.getLong("id"),r.getString("nom"),Objects.requireNonNullElse(r.getString("description"),""),
                r.getString("couverture_url"),r.getString("espace_nom"),r.getBoolean("adhesion_ouverte"),r.getString("visibilite"),
                user==0?"AUCUNE":state(user,r.getLong("espace_id"),r.getLong("id"))),user);
    }
    private List<Request> requests(String where,Object... args) {
        return jdbc.query("""
            SELECT d.*,g.nom AS groupe_nom,e.nom AS espace_nom,u.prenom,u.nom AS demandeur_nom,
              (g.statut='ACTIF' AND e.statut='ACTIF') AS disponible
            FROM demande_adhesion_groupe d JOIN groupe g ON g.id=d.groupe_id
            JOIN espace_organisateur e ON e.id=d.espace_id JOIN utilisateur u ON u.id=d.utilisateur_id
            """+where+" ORDER BY d.date_creation DESC,d.id DESC",(r,n)->new Request(r.getLong("id"),r.getLong("groupe_id"),
                r.getString("groupe_nom"),r.getString("espace_nom"),r.getString("prenom")+" "+r.getString("demandeur_nom"),
                r.getString("statut"),membership(r.getLong("utilisateur_id"),r.getLong("espace_id"),r.getLong("groupe_id")),
                r.getString("motif"),r.getLong("version"),r.getBoolean("disponible")),args);
    }
    @GetMapping("/group-memberships") @Transactional
    public List<Request> mine(Authentication auth) { return requests("WHERE d.utilisateur_id=?",user(auth)); }
    @GetMapping("/group-memberships/received") @Transactional
    public List<Request> received(Authentication auth) {
        long actor=user(auth);
        return requests("""
            WHERE e.statut='ACTIF' AND EXISTS(SELECT 1 FROM appartenance_espace a
              WHERE a.espace_id=d.espace_id AND a.utilisateur_id=? AND a.statut='ACTIF'
              AND (a.role='ADMINISTRATEUR' OR (g.statut='ACTIF' AND g.referents_gerent_adhesions AND EXISTS(
                SELECT 1 FROM appartenance_groupe ag WHERE ag.utilisateur_id=a.utilisateur_id
                AND ag.espace_id=a.espace_id AND ag.groupe_id=g.id AND ag.statut='ACTIF' AND ag.role='REFERENT'))))
            """,actor);
    }

    private long lockSpaceForGroup(long group) {
        var ids=jdbc.query("SELECT espace_id FROM groupe WHERE id=?",(r,n)->r.getLong(1),group);
        if(ids.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Ce groupe n’est pas accessible.");
        long space=ids.getFirst();
        if(jdbc.query("SELECT id FROM espace_organisateur WHERE id=? AND statut='ACTIF' FOR UPDATE",(r,n)->r.getLong(1),space).isEmpty())
            throw error(HttpStatus.NOT_FOUND,"Ce groupe n’est pas accessible.");
        return space;
    }
    private void activeMemberships(long user,long space,long group) {
        var spaces=jdbc.query("SELECT statut FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=? FOR SHARE",(r,n)->r.getString(1),user,space);
        var groups=jdbc.query("SELECT statut FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=? FOR SHARE",(r,n)->r.getString(1),user,group);
        if(spaces.stream().anyMatch(v->!v.equals("ACTIF")) || groups.stream().anyMatch(v->!v.equals("ACTIF")))
            throw error(HttpStatus.FORBIDDEN,"Votre accès a été suspendu ou retiré. Contactez l’administrateur de l’espace.");
    }

    private void admit(long user,long space,long group) {
        if(Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",
            Boolean.class,user)))
            throw error(HttpStatus.CONFLICT,"Le propriétaire de Belconnect ne peut pas devenir membre d’un groupe.");
        activeMemberships(user,space,group);
        jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE') ON CONFLICT(utilisateur_id,espace_id) DO NOTHING",user,space);
        activeMemberships(user,space,group);
        jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE') ON CONFLICT(utilisateur_id,groupe_id) DO NOTHING",user,space,group);
        activeMemberships(user,space,group);
    }
    private Request request(long id) { return requests("WHERE d.id=?",id).getFirst(); }
    private void audit(long actor,long space,long group,String action,long version) {
        jdbc.update("INSERT INTO historique_gestion_espace(espace_id,groupe_id,acteur_id,action,version) VALUES (?,?,?,?,?)",space,group,actor,action,version);
    }
    @PostMapping("/groups/{id}/join") @Transactional
    public Request join(Authentication auth,@PathVariable long id) {
        long user=user(auth), space=lockSpaceForGroup(id);
        var g=jdbc.queryForMap("SELECT * FROM groupe WHERE id=? FOR SHARE",id);
        boolean member=Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=? AND statut='ACTIF')",Boolean.class,user,space));
        if(!"ACTIF".equals(g.get("statut")) || (!"PUBLIQUE".equals(g.get("visibilite")) && !member))
            throw error(HttpStatus.NOT_FOUND,"Ce groupe n’est pas accessible.");
        activeMemberships(user,space,id);
        var prior=jdbc.query("SELECT id FROM demande_adhesion_groupe WHERE utilisateur_id=? AND groupe_id=?",(r,n)->r.getLong(1),user,id);
        if(!prior.isEmpty()) return request(prior.getFirst());
        boolean admitted=Boolean.TRUE.equals(g.get("adhesion_ouverte")) || !membership(user,space,id).equals("AUCUNE");
        if(admitted) admit(user,space,id);
        long request=jdbc.queryForObject("""
            INSERT INTO demande_adhesion_groupe(utilisateur_id,groupe_id,espace_id,statut,date_decision)
            VALUES (?,?,?,?,CASE WHEN ? THEN now() ELSE NULL END) RETURNING id
            """,Long.class,user,id,space,admitted?"ACCEPTEE":"EN_ATTENTE",admitted);
        audit(user,space,id,admitted?"ADHESION_OUVERTE":"ADHESION_DEMANDEE",0);
        return request(request);
    }
    @PostMapping("/group-memberships/{id}/decision") @Transactional
    public Request decide(Authentication auth,@PathVariable long id,@Valid @RequestBody Decision body) {
        long actor=user(auth);
        var rows=jdbc.queryForList("SELECT groupe_id,espace_id,utilisateur_id FROM demande_adhesion_groupe WHERE id=?",id);
        if(rows.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Demande introuvable.");
        var row=rows.getFirst(); long group=((Number)row.get("groupe_id")).longValue(), applicant=((Number)row.get("utilisateur_id")).longValue();
        long space=lockSpaceForGroup(group);
        if(!permissions.canDecide(actor,space,group))
            throw error(HttpStatus.FORBIDDEN,"Cette décision revient à l’administrateur ou à un référent autorisé de ce groupe.");
        jdbc.queryForMap("SELECT id FROM demande_adhesion_groupe WHERE id=? FOR UPDATE",id);
        jdbc.queryForMap("SELECT id FROM groupe WHERE id=? FOR SHARE",group);
        var d=request(id);
        if(!d.status().equals("EN_ATTENTE")) {
            Long examiner=jdbc.queryForObject("SELECT examinateur_id FROM demande_adhesion_groupe WHERE id=?",Long.class,id);
            if(d.version()==body.version()+1 && d.status().equals(body.status()) && d.reason().equals(body.reason()) && Objects.equals(examiner,actor)) return d;
            throw error(HttpStatus.CONFLICT,"Cette demande a déjà été traitée. Actualisez la liste.");
        }
        if(d.version()!=body.version()) throw error(HttpStatus.CONFLICT,"La demande a changé. Actualisez la liste.");
        if(!d.available()) throw error(HttpStatus.CONFLICT,"Ce groupe n’est plus actif.");
        if(body.status().equals("REFUSEE") && body.reason().isBlank()) throw error(HttpStatus.BAD_REQUEST,"Indiquez le motif du refus.");
        if(body.status().equals("ACCEPTEE")) {
            if(jdbc.query("SELECT id FROM utilisateur WHERE id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),applicant).isEmpty())
                throw error(HttpStatus.CONFLICT,"Le compte du demandeur n’est plus actif.");
            admit(applicant,space,group);
        }
        jdbc.update("UPDATE demande_adhesion_groupe SET statut=?,motif=?,examinateur_id=?,date_decision=now(),version=version+1 WHERE id=?",body.status(),body.reason(),actor,id);
        audit(actor,space,group,"ADHESION_"+body.status(),body.version()+1);
        return request(id);
    }
}
