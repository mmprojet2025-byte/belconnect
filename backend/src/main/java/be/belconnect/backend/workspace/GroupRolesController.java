package be.belconnect.backend.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace/groups")
public class GroupRolesController {
    private final JdbcTemplate jdbc;
    public GroupRolesController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Member(long id,String name,String role,long version) {}
    public record Roster(long id,String name,String spaceName,long version,boolean canManageRoles,
                         boolean referentsManageMemberships,boolean canManageMemberships,List<Member> members) {}
    public record RoleChange(@NotNull @Min(0) Long version,@NotNull @Pattern(regexp="MEMBRE|REFERENT") String role) {}
    public record Delegation(@NotNull @Min(0) Long version,@NotNull Boolean manageMemberships) {}
    private record Access(long space,boolean admin,boolean delegated) {}
    private ResponseStatusException error(HttpStatus status,String reason) { return new ResponseStatusException(status,reason); }
    private long user(Authentication auth) {
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),auth.getName())
            .stream().findFirst().orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    private Access access(long user,long group,boolean write) {
        var spaces=jdbc.query("SELECT espace_id FROM groupe WHERE id=?",(r,n)->r.getLong(1),group);
        if(spaces.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Groupe introuvable.");
        long space=spaces.getFirst();
        if(jdbc.query("SELECT id FROM espace_organisateur WHERE id=? AND statut='ACTIF'"+(write?" FOR UPDATE":" FOR SHARE"),(r,n)->r.getLong(1),space).isEmpty())
            throw error(HttpStatus.FORBIDDEN,"Cet espace n’est plus actif.");
        var groups=jdbc.query("SELECT referents_gerent_adhesions FROM groupe WHERE id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getBoolean(1),group);
        if(groups.isEmpty()) throw error(HttpStatus.FORBIDDEN,"Ce groupe n’est plus actif.");
        var roles=jdbc.query("SELECT role FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getString(1),user,space);
        boolean admin=roles.contains("ADMINISTRATEUR");
        boolean referent=!roles.isEmpty() && !jdbc.query("SELECT groupe_id FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=? AND statut='ACTIF' AND role='REFERENT' FOR SHARE",(r,n)->r.getLong(1),user,group).isEmpty();
        if((write && !admin) || (!admin && !referent)) throw error(HttpStatus.FORBIDDEN,"Vous ne disposez pas des droits nécessaires pour gérer les membres de ce groupe.");
        return new Access(space,admin,groups.getFirst());
    }
    private Roster roster(long group,Access access) {
        var members=jdbc.query("""
            SELECT u.id,u.prenom,u.nom,ag.role,ag.version FROM appartenance_groupe ag
            JOIN utilisateur u ON u.id=ag.utilisateur_id
            JOIN appartenance_espace a ON a.utilisateur_id=ag.utilisateur_id AND a.espace_id=ag.espace_id
            WHERE ag.groupe_id=? AND ag.statut='ACTIF' AND a.statut='ACTIF' AND u.statut='ACTIF'
            ORDER BY u.prenom,u.nom,u.id
            """,(r,n)->new Member(r.getLong("id"),r.getString("prenom")+" "+r.getString("nom"),r.getString("role"),r.getLong("version")),group);
        return jdbc.query("SELECT g.*,e.nom AS espace_nom FROM groupe g JOIN espace_organisateur e ON e.id=g.espace_id WHERE g.id=?",
            (r,n)->new Roster(group,r.getString("nom"),r.getString("espace_nom"),r.getLong("version"),access.admin(),r.getBoolean("referents_gerent_adhesions"),
                access.admin() || r.getBoolean("referents_gerent_adhesions"),members),group).getFirst();
    }
    @GetMapping("/{id}/members") @Transactional
    public Roster get(Authentication auth,@PathVariable long id) { return roster(id,access(user(auth),id,false)); }
    @PostMapping("/{id}/members/{memberId}/role") @Transactional
    public Roster role(Authentication auth,@PathVariable long id,@PathVariable long memberId,@Valid @RequestBody RoleChange body) {
        long actor=user(auth); var access=access(actor,id,true);
        // A role can only be assigned to an already active member in this exact group and space.
        var rows=jdbc.queryForList("""
            SELECT ag.role,ag.version FROM appartenance_groupe ag
            JOIN appartenance_espace a ON a.utilisateur_id=ag.utilisateur_id AND a.espace_id=ag.espace_id
            JOIN utilisateur u ON u.id=ag.utilisateur_id
            WHERE ag.groupe_id=? AND ag.espace_id=? AND ag.utilisateur_id=? AND ag.statut='ACTIF'
              AND a.statut='ACTIF' AND u.statut='ACTIF' FOR UPDATE OF ag FOR SHARE OF a,u
            """,id,access.space(),memberId);
        if(rows.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Ce compte n’est pas un membre actif de ce groupe.");
        var row=rows.getFirst();long version=((Number)row.get("version")).longValue();
        if(version!=body.version()) {
            if(version==body.version()+1 && body.role().equals(row.get("role"))) return roster(id,access);
            throw error(HttpStatus.CONFLICT,"Le rôle a changé. Actualisez les membres avant de réessayer.");
        }
        if(body.role().equals(row.get("role"))) return roster(id,access);
        jdbc.update("UPDATE appartenance_groupe SET role=?,version=version+1 WHERE groupe_id=? AND utilisateur_id=?",body.role(),id,memberId);
        jdbc.update("""
            INSERT INTO historique_gestion_espace(espace_id,groupe_id,acteur_id,cible_utilisateur_id,action,version)
            VALUES (?,?,?,?,?,?)
            """,access.space(),id,actor,memberId,body.role().equals("REFERENT")?"REFERENT_DESIGNE":"REFERENT_RETIRE",version+1);
        return roster(id,access);
    }
    @PostMapping("/{id}/permissions") @Transactional
    public Roster permissions(Authentication auth,@PathVariable long id,@Valid @RequestBody Delegation body) {
        long actor=user(auth);var access=access(actor,id,true);
        if(jdbc.update("UPDATE groupe SET referents_gerent_adhesions=?,version=version+1 WHERE id=? AND version=?",body.manageMemberships(),id,body.version())!=1)
            throw error(HttpStatus.CONFLICT,"Les paramètres du groupe ont changé. Actualisez les membres avant de réessayer.");
        jdbc.update("INSERT INTO historique_gestion_espace(espace_id,groupe_id,acteur_id,action,version) VALUES (?,?,?,'DELEGATION_ADHESIONS',?)",access.space(),id,actor,body.version()+1);
        return roster(id,access);
    }
}
