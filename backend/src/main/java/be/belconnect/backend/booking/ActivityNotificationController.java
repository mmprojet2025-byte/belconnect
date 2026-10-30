package be.belconnect.backend.booking;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notifications")
public class ActivityNotificationController {
  private final JdbcTemplate jdbc;
  public ActivityNotificationController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  public record Notice(long id,String title,OffsetDateTime createdAt) {}
  private long user(Authentication auth) {
    return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst()
      .orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
  }
  @GetMapping @Transactional(readOnly=true)
  public ResponseEntity<List<Notice>> unread(Authentication auth) {
    var notices=jdbc.query("""
      SELECT n.id,a.titre,n.date_creation FROM notification_activite n
      JOIN activite a ON a.id=n.activite_id
      WHERE n.utilisateur_id=? AND n.date_lecture IS NULL
      ORDER BY n.date_creation DESC,n.id DESC LIMIT 20
      """,(r,i)->new Notice(r.getLong("id"),r.getString("titre"),r.getObject("date_creation",OffsetDateTime.class)),user(auth));
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(notices);
  }
  public record UnreadCount(long unread) {}
  @GetMapping("/count") @Transactional(readOnly=true)
  public ResponseEntity<UnreadCount> count(Authentication auth) {
    long actor=user(auth);
    Long count=jdbc.queryForObject("""
      SELECT (SELECT count(*) FROM notification_activite WHERE utilisateur_id=? AND date_lecture IS NULL)
           + (SELECT count(*) FROM notification_demande_espace WHERE utilisateur_id=? AND date_lecture IS NULL)
           + (SELECT count(*) FROM notification_adhesion_groupe WHERE utilisateur_id=? AND date_lecture IS NULL)
           + (SELECT count(*) FROM notification_projet WHERE utilisateur_id=? AND date_lecture IS NULL)
      """,Long.class,actor,actor,actor,actor);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new UnreadCount(count == null ? 0 : count));
  }
  @PostMapping("/{id}/read") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
  public void read(Authentication auth,@PathVariable long id) {
    long actor=user(auth);
    if(jdbc.update("UPDATE notification_activite SET date_lecture=now() WHERE id=? AND utilisateur_id=? AND date_lecture IS NULL",id,actor)==0
      && jdbc.queryForList("SELECT id FROM notification_activite WHERE id=? AND utilisateur_id=?",id,actor).isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Avis introuvable.");
  }
}
