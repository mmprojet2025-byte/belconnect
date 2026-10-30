package be.belconnect.backend.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/groups")
public class GroupDirectInvitationController {
  private final JdbcTemplate jdbc;
  private final GroupMembershipLimit limit;
  public GroupDirectInvitationController(JdbcTemplate jdbc,GroupMembershipLimit limit){this.jdbc=jdbc;this.limit=limit;}
  public record Invite(@NotBlank @Email String email) {}
  public record Invitation(long id,long groupId,String groupName,String spaceName,String status,OffsetDateTime createdAt) {}
  private long actor(Authentication auth){return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));}
  private ResponseStatusException fail(HttpStatus status,String detail){return new ResponseStatusException(status,detail);}
  @PostMapping("/{groupId}/invite") @ResponseStatus(HttpStatus.CREATED) @Transactional
  public Invitation invite(Authentication auth,@PathVariable long groupId,@Valid @RequestBody Invite body){
    long inviter=actor(auth);
    var groups=jdbc.queryForList("SELECT g.espace_id,g.nom,e.nom AS espace_nom FROM groupe g JOIN espace_organisateur e ON e.id=g.espace_id WHERE g.id=? AND g.statut='ACTIF' AND g.visibilite='PRIVEE' AND e.statut='ACTIF'",groupId);
    if(groups.isEmpty())throw fail(HttpStatus.NOT_FOUND,"Groupe privé indisponible.");
    long space=((Number)groups.getFirst().get("espace_id")).longValue();
    Boolean admin=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=? AND role='ADMINISTRATEUR' AND statut='ACTIF')",Boolean.class,inviter,space);
    if(!Boolean.TRUE.equals(admin))throw fail(HttpStatus.FORBIDDEN,"Seul l’administrateur peut inviter.");
    var users=jdbc.query("SELECT id FROM utilisateur WHERE lower(email)=lower(?) AND statut='ACTIF'",(r,n)->r.getLong(1),body.email().strip());
    if(users.isEmpty())throw fail(HttpStatus.NOT_FOUND,"Aucun compte actif avec cette adresse.");
    long invited=users.getFirst();
    if(invited==inviter)throw fail(HttpStatus.CONFLICT,"Vous êtes déjà administrateur de ce groupe.");
    Boolean owner=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",Boolean.class,invited);
    if(Boolean.TRUE.equals(owner))throw fail(HttpStatus.CONFLICT,"Le propriétaire ne peut pas rejoindre un groupe.");
    Boolean member=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=? AND statut='ACTIF')",Boolean.class,invited,groupId);
    if(Boolean.TRUE.equals(member))throw fail(HttpStatus.CONFLICT,"Cette personne est déjà membre.");
    Boolean blocked=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=? AND statut<>'ACTIF')",Boolean.class,invited,space);
    if(Boolean.TRUE.equals(blocked))throw fail(HttpStatus.CONFLICT,"Cette personne ne peut pas rejoindre cet espace.");
    Boolean groupBlocked=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=? AND statut<>'ACTIF')",Boolean.class,invited,groupId);
    if(Boolean.TRUE.equals(groupBlocked))throw fail(HttpStatus.CONFLICT,"Cette personne ne peut pas rejoindre ce groupe.");
    jdbc.update("""
      INSERT INTO invitation_groupe(groupe_id,invite_id,inviter_id) VALUES (?,?,?)
      ON CONFLICT (groupe_id,invite_id) DO UPDATE SET statut='EN_ATTENTE',inviter_id=excluded.inviter_id,date_creation=now(),date_decision=NULL,date_lecture=NULL
      """,groupId,invited,inviter);
    return listFor(invited).stream().filter(i->i.groupId()==groupId).findFirst().orElseThrow();
  }
  private List<Invitation> listFor(long user){return jdbc.query("""
    SELECT i.id,i.groupe_id,g.nom,e.nom AS espace_nom,i.statut,i.date_creation
    FROM invitation_groupe i JOIN groupe g ON g.id=i.groupe_id JOIN espace_organisateur e ON e.id=g.espace_id
    WHERE i.invite_id=? ORDER BY i.date_creation DESC
    """,(r,n)->new Invitation(r.getLong(1),r.getLong(2),r.getString(3),r.getString(4),r.getString(5),r.getObject(6,OffsetDateTime.class)),user);}
  @GetMapping("/invitations/mine") @Transactional(readOnly=true)
  public List<Invitation> mine(Authentication auth){return listFor(actor(auth));}
  @PostMapping("/invitations/{id}/{decision}") @Transactional
  public Invitation decide(Authentication auth,@PathVariable long id,@PathVariable String decision){
    long user=actor(auth);
    if(!decision.equals("accept")&&!decision.equals("decline"))throw fail(HttpStatus.NOT_FOUND,"Décision inconnue.");
    var rows=jdbc.queryForList("""
      SELECT i.groupe_id,g.espace_id FROM invitation_groupe i JOIN groupe g ON g.id=i.groupe_id
      JOIN espace_organisateur e ON e.id=g.espace_id WHERE i.id=? AND i.invite_id=? AND i.statut='EN_ATTENTE'
      AND g.statut='ACTIF' AND g.visibilite='PRIVEE' AND e.statut='ACTIF' FOR UPDATE OF i
      """,id,user);
    if(rows.isEmpty())throw fail(HttpStatus.NOT_FOUND,"Invitation indisponible.");
    long group=((Number)rows.getFirst().get("groupe_id")).longValue(),space=((Number)rows.getFirst().get("espace_id")).longValue();
    if(decision.equals("accept")){
      Boolean blocked=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=? AND statut<>'ACTIF')",Boolean.class,user,space);
      if(Boolean.TRUE.equals(blocked))throw fail(HttpStatus.FORBIDDEN,"Votre accès à cet espace est suspendu.");
      Boolean groupBlocked=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=? AND statut<>'ACTIF')",Boolean.class,user,group);
      if(Boolean.TRUE.equals(groupBlocked))throw fail(HttpStatus.FORBIDDEN,"Votre accès à ce groupe est suspendu.");
      limit.check(user,group);
      jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE') ON CONFLICT DO NOTHING",user,space);
      jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE') ON CONFLICT DO NOTHING",user,space,group);
      jdbc.update("UPDATE demande_adhesion_groupe SET statut='ACCEPTEE',date_decision=now(),version=version+1 WHERE utilisateur_id=? AND groupe_id=? AND statut='EN_ATTENTE'",user,group);
    }
    jdbc.update("UPDATE invitation_groupe SET statut=?,date_decision=now(),date_lecture=now() WHERE id=?",decision.equals("accept")?"ACCEPTEE":"REFUSEE",id);
    return listFor(user).stream().filter(i->i.id()==id).findFirst().orElseThrow();
  }
}
