package be.belconnect.backend.contact;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace/owner/contact-feedback")
public class OwnerContactFeedbackController {
  private final JdbcTemplate jdbc;
  public OwnerContactFeedbackController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  public record Feedback(long id,String name,String email,String category,String message,boolean replyRequested,String status,OffsetDateTime receivedAt,OffsetDateTime processedAt,OffsetDateTime anonymizedAt) {}
  public record StatusChange(String status) {}

  private long owner(Authentication auth) {
    if (auth == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Accès réservé au propriétaire de Belconnect.");
    var ids=jdbc.query("""
      SELECT u.id FROM role_plateforme r JOIN utilisateur u ON u.id=r.utilisateur_id
      WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE'
      """,(r,n)->r.getLong(1),auth.getName());
    if(ids.isEmpty())
      throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Accès réservé au propriétaire de Belconnect.");
    return ids.getFirst();
  }
  private List<Feedback> feedback(String where,Object... args) {
    return jdbc.query("""
      SELECT id,nom,email,categorie,message,reponse_souhaitee,statut,date_creation,date_traitement,date_anonymisation
      FROM message_contact
      """+where+" ORDER BY date_creation DESC,id DESC",
      (r,n)->new Feedback(r.getLong("id"),r.getString("nom"),r.getString("email"),r.getString("categorie"),
        r.getString("message"),r.getBoolean("reponse_souhaitee"),r.getString("statut"),r.getObject("date_creation",OffsetDateTime.class),r.getObject("date_traitement",OffsetDateTime.class),r.getObject("date_anonymisation",OffsetDateTime.class)),args);
  }
  @GetMapping @Transactional(readOnly=true)
  public ResponseEntity<List<Feedback>> list(Authentication auth) {
    owner(auth);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(feedback(""));
  }
  @GetMapping("/{id}") @Transactional(readOnly=true)
  public ResponseEntity<Feedback> detail(Authentication auth,@PathVariable long id) {
    owner(auth);
    var item=feedback("WHERE id=?",id).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Retour introuvable."));
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(item);
  }
  @PostMapping("/{id}/status") @Transactional
  public Feedback status(Authentication auth,@PathVariable long id,@RequestBody StatusChange body) {
    long actor=owner(auth);
    String status=body==null||body.status()==null?"":body.status().trim().toUpperCase();
    if(!Set.of("NOUVEAU","EN_COURS","TRAITE").contains(status))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choisissez un statut valide.");
    var old=jdbc.query("SELECT statut FROM message_contact WHERE id=? FOR UPDATE",(r,n)->r.getString(1),id).stream().findFirst()
      .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Retour introuvable."));
    if(old.equals(status)) return feedback("WHERE id=?",id).getFirst();
    jdbc.update("UPDATE message_contact SET statut=?,date_traitement=CASE WHEN ?='TRAITE' THEN COALESCE(date_traitement,now()) ELSE date_traitement END WHERE id=?",status,status,id);
    jdbc.update("INSERT INTO historique_message_contact(message_id,acteur_id,action,ancien_statut,nouveau_statut) VALUES (?,?,'STATUT_MODIFIE',?,?)",id,actor,old,status);
    return feedback("WHERE id=?",id).getFirst();
  }
  @PostMapping("/{id}/anonymize") @Transactional
  public Feedback anonymize(Authentication auth,@PathVariable long id) {
    long actor=owner(auth);
    var old=jdbc.query("SELECT statut FROM message_contact WHERE id=? FOR UPDATE",(r,n)->r.getString(1),id).stream().findFirst()
      .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Retour introuvable."));
    if(jdbc.update("""
      UPDATE message_contact SET utilisateur_id=NULL,nom=NULL,email=NULL,message='[Contenu anonymisé]',
        reponse_souhaitee=false,consentement=false,statut='ARCHIVE',date_anonymisation=COALESCE(date_anonymisation,now())
      WHERE id=? AND date_anonymisation IS NULL
      """,id)==1)
      jdbc.update("INSERT INTO historique_message_contact(message_id,acteur_id,action,ancien_statut,nouveau_statut) VALUES (?,?,'ANONYMISE',?,'ARCHIVE')",id,actor,old);
    return feedback("WHERE id=?",id).getFirst();
  }
}
