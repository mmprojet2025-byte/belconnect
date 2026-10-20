package be.belconnect.backend.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace/owner/moderation")
public class OwnerModerationController {
  private final JdbcTemplate jdbc;
  public OwnerModerationController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  public record Space(long id,String name,String status,String reason,long administrators) {}
  public record Content(long id,String title,String type,boolean hidden) {}
  public record Entry(long id,long spaceId,Long activityId,Long projectId,String action,String reason,OffsetDateTime at) {}
  public record Overview(List<Space> spaces,List<Entry> recent) {}
  public record Change(@NotBlank @Size(min=10,max=1000) String reason) {}
  private ResponseStatusException error(HttpStatus status,String text) { return new ResponseStatusException(status,text); }
  private String reason(Change body) {
    String value=body.reason().strip();
    if(value.length()<10) throw error(HttpStatus.BAD_REQUEST,"Précisez le motif en au moins 10 caractères.");
    return value;
  }
  private long owner(Authentication auth) {
    return jdbc.query("""
      SELECT u.id FROM utilisateur u JOIN role_plateforme r ON r.utilisateur_id=u.id
      WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE'
      """,(r,n)->r.getLong(1),auth.getName()).stream().findFirst()
      .orElseThrow(()->error(HttpStatus.FORBIDDEN,"Action réservée au propriétaire de Belconnect."));
  }
  @GetMapping @Transactional(readOnly=true)
  public Overview overview(Authentication auth) {
    owner(auth);
    var spaces=jdbc.query("""
      SELECT e.id,e.nom,e.statut,
        COALESCE((SELECT m.motif FROM moderation_plateforme m WHERE m.espace_id=e.id
          AND m.action IN ('SUSPENDRE_ESPACE','REACTIVER_ESPACE') ORDER BY m.id DESC LIMIT 1),'') AS motif,
        (SELECT count(*) FROM appartenance_espace a JOIN utilisateur u ON u.id=a.utilisateur_id
          WHERE a.espace_id=e.id AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF' AND u.statut='ACTIF') AS administrateurs
      FROM espace_organisateur e WHERE e.statut<>'FERME' ORDER BY e.nom,e.id
      """,(r,n)->new Space(r.getLong("id"),r.getString("nom"),r.getString("statut"),r.getString("motif"),r.getLong("administrateurs")));
    var recent=jdbc.query("""
      SELECT * FROM moderation_plateforme ORDER BY id DESC LIMIT 50
      """,(r,n)->new Entry(r.getLong("id"),r.getLong("espace_id"),r.getObject("activite_id",Long.class),
        r.getObject("projet_id",Long.class),r.getString("action"),r.getString("motif"),r.getObject("date_action",OffsetDateTime.class)));
    return new Overview(spaces,recent);
  }
  @GetMapping("/spaces/{spaceId}/content") @Transactional(readOnly=true)
  public List<Content> content(Authentication auth,@PathVariable long spaceId) {
    owner(auth);
    return jdbc.query("""
      SELECT id,titre,'ACTIVITE' AS type,masquee_moderation AS masque FROM activite
      WHERE espace_id=? AND publiee AND NOT annulee
      UNION ALL
      SELECT id,titre,'PROJET' AS type,masque_moderation AS masque FROM projet
      WHERE espace_id=? AND publie AND statut='APPROUVE'
      ORDER BY type,id DESC
      """,(r,n)->new Content(r.getLong("id"),r.getString("titre"),r.getString("type"),r.getBoolean("masque")),spaceId,spaceId);
  }
  @PostMapping("/spaces/{spaceId}/{action:suspend|reactivate}") @Transactional @ResponseStatus(HttpStatus.NO_CONTENT)
  public void space(Authentication auth,@PathVariable long spaceId,@PathVariable String action,@Valid @RequestBody Change body) {
    long actor=owner(auth);String reason=reason(body);
    var rows=jdbc.queryForList("SELECT statut FROM espace_organisateur WHERE id=? FOR UPDATE",spaceId);
    if(rows.isEmpty() || "FERME".equals(rows.getFirst().get("statut"))) throw error(HttpStatus.NOT_FOUND,"Espace introuvable.");
    String expected="suspend".equals(action)?"ACTIF":"SUSPENDU";
    if(!expected.equals(rows.getFirst().get("statut"))) throw error(HttpStatus.CONFLICT,"Le statut de l’espace a changé. Actualisez.");
    jdbc.update("UPDATE espace_organisateur SET statut=?,version=version+1 WHERE id=?",
      "suspend".equals(action)?"SUSPENDU":"ACTIF",spaceId);
    log(spaceId,null,null,actor,"suspend".equals(action)?"SUSPENDRE_ESPACE":"REACTIVER_ESPACE",reason);
  }
  @PostMapping("/spaces/{spaceId}/{type:activities|projects}/{id}/{action:hide|restore}") @Transactional @ResponseStatus(HttpStatus.NO_CONTENT)
  public void content(Authentication auth,@PathVariable long spaceId,@PathVariable String type,@PathVariable long id,
      @PathVariable String action,@Valid @RequestBody Change body) {
    long actor=owner(auth);String reason=reason(body);
    if(jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? FOR UPDATE",spaceId).isEmpty())
      throw error(HttpStatus.NOT_FOUND,"Espace introuvable.");
    boolean activity="activities".equals(type);
    String table=activity?"activite":"projet",flag=activity?"masquee_moderation":"masque_moderation";
    String published=activity?"publiee AND NOT annulee":"publie AND statut='APPROUVE'";
    var rows=jdbc.queryForList("SELECT "+flag+" AS masque FROM "+table+" WHERE id=? AND espace_id=? AND "+published+" FOR UPDATE",id,spaceId);
    if(rows.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Contenu introuvable dans cet espace.");
    boolean hidden=Boolean.TRUE.equals(rows.getFirst().get("masque")),hide="hide".equals(action);
    if(hidden==hide) throw error(HttpStatus.CONFLICT,"Ce contenu a déjà changé. Actualisez.");
    jdbc.update("UPDATE "+table+" SET "+flag+"=? WHERE id=? AND espace_id=?",hide,id,spaceId);
    log(spaceId,activity?id:null,activity?null:id,actor,hide?"MASQUER":"RETABLIR",reason);
  }
  private void log(long space,Long activity,Long project,long actor,String action,String reason) {
    jdbc.update("""
      INSERT INTO moderation_plateforme(espace_id,activite_id,projet_id,acteur_id,action,motif)
      VALUES (?,?,?,?,?,?)
      """,space,activity,project,actor,action,reason);
  }
}
