package be.belconnect.backend.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/group-announcements")
public class GroupAnnouncementController {
  private final JdbcTemplate jdbc;
  public GroupAnnouncementController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  public record Creation(@NotNull UUID requestId,@NotNull Long groupId,@NotBlank @Size(max=1000) String content) {}
  public record Announcement(long id,long groupId,String groupName,String author,String content,OffsetDateTime createdAt) {}
  private ResponseStatusException error(HttpStatus code,String message) { return new ResponseStatusException(code,message); }
  private long user(Authentication auth) {
    return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst()
      .orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
  }
  private boolean canRead(long actor,long space,long group) {
    return !jdbc.queryForList("SELECT id FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=? AND role='ADMINISTRATEUR' AND statut='ACTIF' FOR SHARE",space,actor).isEmpty()
      || !jdbc.queryForList("SELECT groupe_id FROM appartenance_groupe WHERE espace_id=? AND groupe_id=? AND utilisateur_id=? AND statut='ACTIF' FOR SHARE",space,group,actor).isEmpty();
  }
  @GetMapping @Transactional(readOnly=true)
  public ResponseEntity<List<Announcement>> list(Authentication auth) {
    long actor=user(auth);
    var items=jdbc.query("""
      SELECT n.id,n.groupe_id,g.nom AS groupe_nom,u.prenom,u.nom AS auteur_nom,n.contenu,n.date_creation
      FROM annonce_groupe n JOIN groupe g ON g.id=n.groupe_id
      JOIN espace_organisateur e ON e.id=g.espace_id JOIN utilisateur u ON u.id=n.auteur_id
      WHERE e.statut='ACTIF' AND g.statut='ACTIF' AND EXISTS (
        SELECT 1 FROM appartenance_espace ae WHERE ae.espace_id=g.espace_id AND ae.utilisateur_id=? AND ae.statut='ACTIF'
          AND (ae.role='ADMINISTRATEUR' OR EXISTS (
            SELECT 1 FROM appartenance_groupe ag WHERE ag.groupe_id=g.id AND ag.espace_id=g.espace_id
              AND ag.utilisateur_id=ae.utilisateur_id AND ag.statut='ACTIF')))
      ORDER BY n.date_creation DESC,n.id DESC LIMIT 50
      """,(r,i)->new Announcement(r.getLong("id"),r.getLong("groupe_id"),r.getString("groupe_nom"),r.getString("prenom")+" "+r.getString("auteur_nom"),r.getString("contenu"),r.getObject("date_creation",OffsetDateTime.class)),actor);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(items);
  }
  @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
  public Announcement create(Authentication auth,@Valid @RequestBody Creation body) {
    long actor=user(auth);
    String content=body.content().strip();
    var group=jdbc.queryForList("SELECT espace_id,statut FROM groupe WHERE id=?",body.groupId());
    if(group.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Groupe introuvable.");
    long space=((Number)group.getFirst().get("espace_id")).longValue();
    if(jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? AND statut='ACTIF' FOR UPDATE",space).isEmpty())
      throw error(HttpStatus.CONFLICT,"Cet espace n’est pas actif.");
    if(jdbc.queryForList("SELECT id FROM groupe WHERE id=? AND espace_id=? AND statut='ACTIF' FOR SHARE",body.groupId(),space).isEmpty())
      throw error(HttpStatus.CONFLICT,"Ce groupe n’est pas actif.");
    if(!canRead(actor,space,body.groupId())) throw error(HttpStatus.FORBIDDEN,"Vous ne faites pas partie de ce groupe.");
    boolean admin=!jdbc.queryForList("SELECT id FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=? AND role='ADMINISTRATEUR' AND statut='ACTIF' FOR SHARE",space,actor).isEmpty();
    boolean referent=!jdbc.queryForList("SELECT groupe_id FROM appartenance_groupe WHERE groupe_id=? AND espace_id=? AND utilisateur_id=? AND role='REFERENT' AND statut='ACTIF' FOR SHARE",body.groupId(),space,actor).isEmpty();
    if(!admin && !referent) throw error(HttpStatus.FORBIDDEN,"Seuls l’administrateur et le référent de ce groupe peuvent publier une annonce.");
    var old=jdbc.queryForList("SELECT id,groupe_id,contenu FROM annonce_groupe WHERE auteur_id=? AND demande=?",actor,body.requestId());
    if(!old.isEmpty()) {
      var previous=old.getFirst();
      if(((Number)previous.get("groupe_id")).longValue()!=body.groupId() || !content.equals(previous.get("contenu")))
        throw error(HttpStatus.CONFLICT,"Cette annonce a déjà été envoyée avec un autre contenu.");
      return find(((Number)previous.get("id")).longValue());
    }
    long id=jdbc.queryForObject("INSERT INTO annonce_groupe(groupe_id,auteur_id,contenu,demande) VALUES (?,?,?,?) RETURNING id",Long.class,body.groupId(),actor,content,body.requestId());
    return find(id);
  }
  private Announcement find(long id) {
    return jdbc.queryForObject("""
      SELECT n.id,n.groupe_id,g.nom AS groupe_nom,u.prenom,u.nom AS auteur_nom,n.contenu,n.date_creation
      FROM annonce_groupe n JOIN groupe g ON g.id=n.groupe_id JOIN utilisateur u ON u.id=n.auteur_id WHERE n.id=?
      """,(r,i)->new Announcement(r.getLong("id"),r.getLong("groupe_id"),r.getString("groupe_nom"),r.getString("prenom")+" "+r.getString("auteur_nom"),r.getString("contenu"),r.getObject("date_creation",OffsetDateTime.class)),id);
  }
}
