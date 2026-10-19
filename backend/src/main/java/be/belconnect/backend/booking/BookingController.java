package be.belconnect.backend.booking;

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
@RequestMapping("/api/bookings")
public class BookingController {
 private final JdbcTemplate jdbc;
 private final be.belconnect.backend.activity.ActivityAccess access;
 public BookingController(JdbcTemplate jdbc,be.belconnect.backend.activity.ActivityAccess access) { this.jdbc=jdbc; this.access=access; }
 public record Request(@NotBlank @Size(max=100) String activityId, @Min(1) @Max(4) int quantity,
   @NotBlank @Size(max=80) String firstName, @NotBlank @Size(max=80) String lastName,
   @NotBlank @Email @Size(max=254) String email, @Size(max=30) String phone,
   @AssertTrue boolean acknowledged) {}
 public record Booking(long id, String activityId, String title, OffsetDateTime startsAt, String location,
   int quantity, String firstName, String lastName, String email, String phone, String status, boolean activityCancelled, long version) {}
 public record Modification(@Min(1) @Max(4) int quantity,
   @NotBlank @Size(max=80) String firstName, @NotBlank @Size(max=80) String lastName,
   @NotBlank @Email @Size(max=254) String email, @Size(max=30) String phone,
   @NotNull @Min(0) Long version) {}
 private long user(Authentication auth) {
  return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",
    (r,n)->r.getLong(1),auth.getName()).stream().findFirst()
    .orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
 }
 @GetMapping public List<Booking> list(Authentication auth) { return listFor(user(auth)); }
 private List<Booking> listFor(long userId) {
  return jdbc.query("""
   SELECT i.*, a.slug, a.titre, a.debut, a.lieu, a.annulee FROM inscription_activite i
   JOIN activite a ON a.id=i.activite_id WHERE i.utilisateur_id=? ORDER BY a.debut, i.id
   """, (r,n)->new Booking(r.getLong("id"),r.getString("slug"),r.getString("titre"),
    r.getObject("debut",OffsetDateTime.class),r.getString("lieu"),r.getInt("quantite"),
    r.getString("prenom"),r.getString("nom"),r.getString("email"),r.getString("telephone"),r.getString("statut"),r.getBoolean("annulee"),r.getLong("version")),userId);
 }
 @PostMapping @Transactional @ResponseStatus(HttpStatus.CREATED)
 public Booking create(Authentication auth, @Valid @RequestBody Request body) {
  long userId=user(auth);
  var ids=jdbc.queryForList("SELECT id FROM activite WHERE slug=?",Long.class,body.activityId());
  if(ids.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Activité introuvable.");
  access.lockAndCheck(ids.getFirst(),userId);
  // Serialize reservations for the same activity, so the last places cannot be oversold.
  var rows=jdbc.queryForList("SELECT id, prix, publiee, debut, places_disponibles FROM activite WHERE slug=? FOR UPDATE",body.activityId());
  if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Activité introuvable.");
  var row=rows.getFirst(); long activityId=((Number)row.get("id")).longValue();
  if(!Boolean.TRUE.equals(row.get("publiee"))) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Activité indisponible.");
  if(jdbc.queryForObject("SELECT count(*) FROM inscription_activite WHERE utilisateur_id=? AND activite_id=? AND statut='CONFIRMEE'",Integer.class,userId,activityId)>0)
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Vous êtes déjà inscrit à cette activité. Retrouvez-la dans Mon espace.");
  if(((java.math.BigDecimal)row.get("prix")).signum()!=0)
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Les inscriptions payantes restent en démonstration.");
  if(jdbc.queryForObject("SELECT COALESCE(cloture_inscriptions,debut) <= clock_timestamp() FROM activite WHERE id=?",Boolean.class,activityId))
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Les inscriptions à cette activité sont closes.");
  if(((Number)row.get("places_disponibles")).intValue()<body.quantity())
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Il ne reste pas assez de places. Revenez au catalogue pour actualiser les disponibilités.");
  jdbc.update("UPDATE activite SET places_disponibles=places_disponibles-? WHERE id=?",body.quantity(),activityId);
  long id=jdbc.queryForObject("""
   INSERT INTO inscription_activite(utilisateur_id,activite_id,quantite,prenom,nom,email,telephone)
   VALUES (?,?,?,?,?,?,?) RETURNING id
   """,Long.class,userId,activityId,body.quantity(),body.firstName().strip(),body.lastName().strip(),
   body.email().strip(),body.phone()==null?"":body.phone().strip());
  return listFor(userId).stream().filter(b->b.id()==id).findFirst().orElseThrow();
 }
 @PostMapping("/{id}/cancel") @Transactional @ResponseStatus(HttpStatus.NO_CONTENT)
 public void cancel(Authentication auth, @PathVariable long id) {
  long userId=user(auth);
  var owned=jdbc.queryForList("SELECT activite_id FROM inscription_activite WHERE id=? AND utilisateur_id=?",id,userId);
  if(owned.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Inscription introuvable.");
  long activityId=((Number)owned.getFirst().get("activite_id")).longValue();
  // Same lock order as creation: activity first. Re-read the status after acquiring it.
  jdbc.queryForObject("SELECT id FROM activite WHERE id=? FOR UPDATE",Long.class,activityId);
  var booking=jdbc.queryForMap("SELECT statut, quantite FROM inscription_activite WHERE id=? AND utilisateur_id=?",id,userId);
  if("ANNULEE".equals(booking.get("statut"))) return;
  if(jdbc.queryForObject("SELECT debut <= clock_timestamp() FROM activite WHERE id=?",Boolean.class,activityId))
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette activité a déjà commencé. L’annulation n’est plus disponible.");
  jdbc.update("UPDATE inscription_activite SET statut='ANNULEE', date_annulation=now(), version=version+1 WHERE id=?",id);
  jdbc.update("UPDATE activite SET places_disponibles=places_disponibles+? WHERE id=?",booking.get("quantite"),activityId);
 }

 @PostMapping("/{id}/modify") @Transactional
 public Booking modify(Authentication auth, @PathVariable long id, @Valid @RequestBody Modification body) {
  long userId=user(auth);
  var owned=jdbc.queryForList("SELECT activite_id FROM inscription_activite WHERE id=? AND utilisateur_id=?",id,userId);
  if(owned.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Inscription introuvable.");
  long activityId=((Number)owned.getFirst().get("activite_id")).longValue();
  try { access.lockAndCheck(activityId,userId); }
  catch(ResponseStatusException e) { throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette activité ne permet plus la modification. Vous pouvez encore annuler avant son début."); }
  var activity=jdbc.queryForMap("SELECT prix, publiee, places_disponibles FROM activite WHERE id=? FOR UPDATE",activityId);
  var booking=jdbc.queryForMap("SELECT statut, quantite, version FROM inscription_activite WHERE id=? AND utilisateur_id=?",id,userId);
  if(!"CONFIRMEE".equals(booking.get("statut"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette inscription est annulée. Vous pouvez vous réinscrire depuis la fiche de l’activité.");
  if(((Number)booking.get("version")).longValue()!=body.version())
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette inscription a changé. Rechargez vos inscriptions avant de la modifier.");
  if(jdbc.queryForObject("SELECT debut <= clock_timestamp() FROM activite WHERE id=?",Boolean.class,activityId))
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette activité a déjà commencé. La modification n’est plus disponible.");
  if(!Boolean.TRUE.equals(activity.get("publiee")) || ((java.math.BigDecimal)activity.get("prix")).signum()!=0)
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette activité ne permet plus la modification. Vous pouvez encore annuler votre inscription avant son début.");
  if(jdbc.queryForObject("SELECT COALESCE(cloture_inscriptions,debut) <= clock_timestamp() FROM activite WHERE id=?",Boolean.class,activityId))
   throw new ResponseStatusException(HttpStatus.CONFLICT,"La clôture des inscriptions ne permet plus de modification. L’annulation reste disponible avant le début.");
  int delta=body.quantity()-((Number)booking.get("quantite")).intValue();
  if(delta>((Number)activity.get("places_disponibles")).intValue())
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Il ne reste pas assez de places pour ajouter ces participants. Votre inscription est inchangée.");
  jdbc.update("UPDATE activite SET places_disponibles=places_disponibles-? WHERE id=?",delta,activityId);
  jdbc.update("""
   UPDATE inscription_activite SET quantite=?, prenom=?, nom=?, email=?, telephone=?, version=version+1
   WHERE id=? AND utilisateur_id=?
   """,body.quantity(),body.firstName().strip(),body.lastName().strip(),body.email().strip(),body.phone()==null?"":body.phone().strip(),id,userId);
  return listFor(userId).stream().filter(b->b.id()==id).findFirst().orElseThrow();
 }

}
