package be.belconnect.backend.project;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class ProjectPublicationController {
 private final JdbcTemplate jdbc;
 public ProjectPublicationController(JdbcTemplate jdbc) {this.jdbc=jdbc;}
 public record Published(long id,String title,String description,String objective,String spaceName,String groupName,String visibility,LocalDate startsOn,LocalDate endsOn,OffsetDateTime publishedAt) {}
 public record Managed(long id,String title,String spaceName,String visibility,boolean published,long version) {}
 public record Change(@NotNull @Min(0) Long version,@NotNull Boolean published) {}
 private Long user(Authentication auth) {
  if(auth==null) return null;
  return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst().orElse(null);
 }
 private long requiredUser(Authentication auth) {Long id=user(auth);if(id==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);return id;}
 private static final String PUBLIC_SELECT="""
  SELECT p.*,e.nom AS espace_nom,g.nom AS groupe_nom FROM projet p
  JOIN espace_organisateur e ON e.id=p.espace_id LEFT JOIN groupe g ON g.id=p.groupe_id
  WHERE p.publie AND p.statut='APPROUVE' AND e.statut='ACTIF' AND (p.groupe_id IS NULL OR g.statut='ACTIF')
   AND (p.visibilite='PUBLIQUE' OR (p.visibilite='GROUPE' AND EXISTS (
    SELECT 1 FROM appartenance_groupe ag JOIN appartenance_espace ae
     ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
    WHERE ag.groupe_id=p.groupe_id AND ag.espace_id=p.espace_id AND ag.utilisateur_id=?
     AND ag.statut='ACTIF' AND ae.statut='ACTIF')))
  """;
 private final org.springframework.jdbc.core.RowMapper<Published> publicMapper=(r,n)->new Published(r.getLong("id"),r.getString("titre"),r.getString("description"),r.getString("objectif"),r.getString("espace_nom"),r.getString("groupe_nom"),r.getString("visibilite"),r.getObject("debut_prevu",LocalDate.class),r.getObject("fin_prevue",LocalDate.class),r.getObject("date_publication",OffsetDateTime.class));
 @GetMapping("/api/projects") @Transactional(readOnly=true)
 public ResponseEntity<List<Published>> list(Authentication auth) {
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(jdbc.query(PUBLIC_SELECT+" ORDER BY p.date_publication DESC,p.id DESC",publicMapper,user(auth)));
 }
 @GetMapping("/api/projects/{id}") @Transactional(readOnly=true)
 public ResponseEntity<Published> detail(Authentication auth,@PathVariable long id) {
  var p=jdbc.query(PUBLIC_SELECT+" AND p.id=?",publicMapper,user(auth),id).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet indisponible."));
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(p);
 }
 private final org.springframework.jdbc.core.RowMapper<Managed> managedMapper=(r,n)->new Managed(r.getLong("id"),r.getString("titre"),r.getString("espace_nom"),r.getString("visibilite"),r.getBoolean("publie"),r.getLong("version"));
 @GetMapping("/api/project-publications") @Transactional(readOnly=true)
 public List<Managed> manage(Authentication auth) {
  return jdbc.query("""
   SELECT p.*,e.nom AS espace_nom FROM projet p JOIN espace_organisateur e ON e.id=p.espace_id
   JOIN appartenance_espace ae ON ae.espace_id=p.espace_id
   WHERE p.statut='APPROUVE' AND ae.utilisateur_id=? AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF'
   ORDER BY p.date_modification DESC,p.id DESC
   """,managedMapper,requiredUser(auth));
 }
 @PostMapping("/api/project-publications/{id}") @Transactional
 public Managed change(Authentication auth,@PathVariable long id,@Valid @RequestBody Change body) {
  long uid=requiredUser(auth);
  var rows=jdbc.queryForList("SELECT * FROM projet WHERE id=?",id);
  if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND);
  var p=rows.getFirst();
  var membership=jdbc.queryForList("""
   SELECT e.statut,e.nom FROM appartenance_espace ae JOIN espace_organisateur e ON e.id=ae.espace_id
   JOIN utilisateur u ON u.id=ae.utilisateur_id
   WHERE ae.utilisateur_id=? AND ae.espace_id=? AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF' AND u.statut='ACTIF'
   FOR SHARE OF ae,e,u
   """,uid,p.get("espace_id"));
  if(membership.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Projet introuvable dans vos espaces administrés.");
  // Withdrawal remains possible if a space or group is suspended.
  if(body.published() && !"ACTIF".equals(membership.getFirst().get("statut")))throw new ResponseStatusException(HttpStatus.CONFLICT,"L’espace doit être actif pour publier.");
  if(p.get("groupe_id")!=null) {
   var group=jdbc.queryForMap("SELECT statut FROM groupe WHERE id=? FOR SHARE",p.get("groupe_id"));
   if(body.published() && !"ACTIF".equals(group.get("statut")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Le groupe doit être actif pour publier.");
  }
  p=jdbc.queryForMap("SELECT * FROM projet WHERE id=? FOR UPDATE",id);
  var prior=jdbc.queryForList("SELECT administrateur_id,publie FROM publication_projet WHERE projet_id=? AND version_projet=?",id,body.version());
  if(!prior.isEmpty()) {
   var old=prior.getFirst();
   if(((Number)old.get("administrateur_id")).longValue()!=uid || !old.get("publie").equals(body.published()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette version a déjà été traitée. Actualisez la liste.");
  } else {
   if(!"APPROUVE".equals(p.get("statut")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Seul un projet approuvé peut être publié.");
   if(((Number)p.get("version")).longValue()!=body.version())throw new ResponseStatusException(HttpStatus.CONFLICT,"Ce projet a changé. Actualisez la liste.");
   jdbc.update("INSERT INTO publication_projet(projet_id,administrateur_id,version_projet,publie) VALUES (?,?,?,?)",id,uid,body.version(),body.published());
   jdbc.update("UPDATE projet SET publie=?,date_publication=CASE WHEN ? THEN now() ELSE date_publication END,version=version+1,date_modification=now() WHERE id=?",body.published(),body.published(),id);
  }
  return jdbc.queryForObject("SELECT p.*,e.nom AS espace_nom FROM projet p JOIN espace_organisateur e ON e.id=p.espace_id WHERE p.id=?",managedMapper,id);
 }
}
