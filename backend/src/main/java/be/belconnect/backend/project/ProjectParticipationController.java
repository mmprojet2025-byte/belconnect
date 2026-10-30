package be.belconnect.backend.project;

import java.time.OffsetDateTime;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/project-participations")
public class ProjectParticipationController {
 private final JdbcTemplate jdbc;
 public ProjectParticipationController(JdbcTemplate jdbc) {this.jdbc=jdbc;}
 public record Creation(@NotNull @Min(1) Long projectId,@NotNull UUID requestId,
  @NotBlank @Pattern(regexp="BENEVOLAT|COMPETENCES|PARTAGE|SOUTIEN_MORAL") String type,@Size(max=1000) String message) {
  public Creation {message=message==null?"":message.strip();}
 }
 public record Version(@NotNull @Min(0) Long version) {}
 public record Decision(@NotNull @Min(0) Long version,@NotBlank @Pattern(regexp="ACCEPTEE|REFUSEE") String status,@Size(max=1000) String reason) {
  public Decision {reason=reason==null?"":reason.strip();}
 }
 public record Participation(long id,long projectId,long spaceId,String title,String imageUrl,String spaceName,String type,String message,String status,String reason,long version,OffsetDateTime createdAt,String participant) {}
 private static final String SELECT="""
  SELECT pp.*,p.espace_id,p.titre,p.image_url,e.nom AS espace_nom,u.prenom,u.nom FROM participation_projet pp
  JOIN projet p ON p.id=pp.projet_id JOIN espace_organisateur e ON e.id=p.espace_id
  JOIN utilisateur u ON u.id=pp.utilisateur_id
  """;
 private final org.springframework.jdbc.core.RowMapper<Participation> mapper=(r,n)->new Participation(r.getLong("id"),r.getLong("projet_id"),r.getLong("espace_id"),r.getString("titre"),r.getString("image_url"),r.getString("espace_nom"),r.getString("type_aide"),r.getString("message"),r.getString("statut"),r.getString("motif"),r.getLong("version"),r.getObject("date_creation",OffsetDateTime.class),r.getString("prenom")+" "+r.getString("nom"));
 private long user(Authentication auth) {return user(auth,false);}
 private long user(Authentication auth,boolean exclusive) {
  return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF' "+(exclusive?"FOR UPDATE":"FOR SHARE"),(r,n)->r.getLong(1),auth.getName()).stream().findFirst().orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
 }
 private ResponseStatusException error(HttpStatus status,String message) {return new ResponseStatusException(status,message);}
 private Participation read(long id) {return jdbc.queryForObject(SELECT+" WHERE pp.id=?",mapper,id);}
 @GetMapping @Transactional(readOnly=true)
 public List<Participation> mine(Authentication auth) {
  long uid=jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst().orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
  return jdbc.query(SELECT+" WHERE pp.utilisateur_id=? ORDER BY pp.date_creation DESC,pp.id DESC",mapper,uid);
 }
 @GetMapping("/received") @Transactional
 public List<Participation> received(Authentication auth) {
  return jdbc.query(SELECT+"""
   WHERE EXISTS (SELECT 1 FROM appartenance_espace ae WHERE ae.utilisateur_id=? AND ae.espace_id=p.espace_id
    AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF') AND e.statut='ACTIF'
   AND (p.groupe_id IS NULL OR EXISTS (SELECT 1 FROM groupe g WHERE g.id=p.groupe_id AND g.statut='ACTIF'))
   ORDER BY pp.date_creation DESC,pp.id DESC
   """,mapper,user(auth));
 }
 @PostMapping @Transactional
 public Participation create(Authentication auth,@Valid @RequestBody Creation body) {
  long uid=user(auth,true);
  var existing=jdbc.queryForList("SELECT * FROM participation_projet WHERE utilisateur_id=? AND creation_request=?",uid,body.requestId());
  if(!existing.isEmpty())return retry(existing.getFirst(),body);
  var projects=jdbc.queryForList("SELECT * FROM projet WHERE id=?",body.projectId());
  if(projects.isEmpty())throw error(HttpStatus.NOT_FOUND,"Projet indisponible.");
  var p=projects.getFirst();
  if(jdbc.query("SELECT id FROM espace_organisateur WHERE id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),p.get("espace_id")).isEmpty())throw error(HttpStatus.NOT_FOUND,"Projet indisponible.");
  if(p.get("groupe_id")!=null && jdbc.query("SELECT id FROM groupe WHERE id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),p.get("groupe_id")).isEmpty())throw error(HttpStatus.NOT_FOUND,"Projet indisponible.");
  if("GROUPE".equals(p.get("visibilite")) && jdbc.query("""
   SELECT ag.utilisateur_id FROM appartenance_groupe ag JOIN appartenance_espace ae ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
   WHERE ag.utilisateur_id=? AND ag.groupe_id=? AND ag.espace_id=? AND ag.statut='ACTIF' AND ae.statut='ACTIF'
   FOR SHARE OF ag,ae
   """,(r,n)->r.getLong(1),uid,p.get("groupe_id"),p.get("espace_id")).isEmpty())throw error(HttpStatus.NOT_FOUND,"Projet indisponible.");
  p=jdbc.queryForMap("SELECT * FROM projet WHERE id=? FOR UPDATE",body.projectId());
  // Serialize with publication changes and other proposals on this project.
  existing=jdbc.queryForList("SELECT * FROM participation_projet WHERE utilisateur_id=? AND creation_request=?",uid,body.requestId());
  if(!existing.isEmpty())return retry(existing.getFirst(),body);
  if(!Boolean.TRUE.equals(p.get("publie")) || p.get("termine_le")!=null || Boolean.TRUE.equals(p.get("masque_moderation")) || !"APPROUVE".equals(p.get("statut")))throw error(HttpStatus.NOT_FOUND,"Ce projet n’accepte plus de propositions.");
  if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT ? = ANY(types_aide) FROM projet WHERE id=?",Boolean.class,body.type(),body.projectId())))
   throw error(HttpStatus.CONFLICT,"Ce projet ne recherche pas ce type d'aide.");
  if(jdbc.queryForObject("SELECT count(*) FROM participation_projet WHERE projet_id=? AND utilisateur_id=? AND type_aide=? AND statut IN ('PROPOSEE','ACCEPTEE')",Integer.class,body.projectId(),uid,body.type())>0)
   throw error(HttpStatus.CONFLICT,"Vous avez déjà proposé cette aide. Consultez vos participations.");
  long id=jdbc.queryForObject("INSERT INTO participation_projet(projet_id,utilisateur_id,type_aide,message,creation_request) VALUES (?,?,?,?,?) RETURNING id",Long.class,body.projectId(),uid,body.type(),body.message(),body.requestId());
  history(id,uid,"PROPOSEE","");return read(id);
 }
 private Participation retry(Map<String,Object> p,Creation body) {
  if(((Number)p.get("projet_id")).longValue()!=body.projectId() || !p.get("type_aide").equals(body.type()) || !p.get("message").equals(body.message()))throw error(HttpStatus.CONFLICT,"Cette demande a déjà été utilisée avec un autre contenu.");
  return read(((Number)p.get("id")).longValue());
 }
 private void history(long id,long uid,String status,String reason) {jdbc.update("INSERT INTO historique_participation(participation_id,acteur_id,statut,motif) VALUES (?,?,?,?)",id,uid,status,reason);}
 @PostMapping("/{id}/cancel") @Transactional
 public Participation cancel(Authentication auth,@PathVariable long id,@Valid @RequestBody Version body) {
  long uid=user(auth);
  var rows=jdbc.queryForList("SELECT * FROM participation_projet WHERE id=? AND utilisateur_id=? FOR UPDATE",id,uid);
  if(rows.isEmpty())throw error(HttpStatus.NOT_FOUND,"Participation introuvable.");
  var p=rows.getFirst();
  if("ANNULEE".equals(p.get("statut")))return read(id);
  if(!List.of("PROPOSEE","ACCEPTEE").contains(p.get("statut")) || ((Number)p.get("version")).longValue()!=body.version())throw error(HttpStatus.CONFLICT,"Cette participation a changé. Actualisez la liste.");
  jdbc.update("UPDATE participation_projet SET statut='ANNULEE',version=version+1,date_modification=now() WHERE id=?",id);
  history(id,uid,"ANNULEE","");return read(id);
 }
 @PostMapping("/{id}/decision") @Transactional
 public Participation decide(Authentication auth,@PathVariable long id,@Valid @RequestBody Decision body) {
  long uid=user(auth);
  var rows=jdbc.queryForList("SELECT pp.projet_id,pp.utilisateur_id,p.espace_id,p.groupe_id,p.visibilite FROM participation_projet pp JOIN projet p ON p.id=pp.projet_id WHERE pp.id=?",id);
  if(rows.isEmpty())throw error(HttpStatus.NOT_FOUND,"Participation introuvable.");
  var row=rows.getFirst();
  if(jdbc.query("""
   SELECT ae.id FROM appartenance_espace ae JOIN espace_organisateur e ON e.id=ae.espace_id
   WHERE ae.utilisateur_id=? AND ae.espace_id=? AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF' AND e.statut='ACTIF'
   FOR SHARE OF ae,e
   """,(r,n)->r.getLong(1),uid,row.get("espace_id")).isEmpty())throw error(HttpStatus.NOT_FOUND,"Participation introuvable.");
  if(row.get("groupe_id")!=null && jdbc.query("SELECT id FROM groupe WHERE id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),row.get("groupe_id")).isEmpty())throw error(HttpStatus.NOT_FOUND,"Groupe indisponible.");
  if("ACCEPTEE".equals(body.status())) {
   if(jdbc.query("SELECT id FROM utilisateur WHERE id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),row.get("utilisateur_id")).isEmpty())throw error(HttpStatus.CONFLICT,"Le compte du participant n’est plus actif.");
   if("GROUPE".equals(row.get("visibilite")) && jdbc.query("""
    SELECT ag.utilisateur_id FROM appartenance_groupe ag JOIN appartenance_espace ae ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
    WHERE ag.utilisateur_id=? AND ag.groupe_id=? AND ag.espace_id=? AND ag.statut='ACTIF' AND ae.statut='ACTIF' FOR SHARE OF ag,ae
    """,(r,n)->r.getLong(1),row.get("utilisateur_id"),row.get("groupe_id"),row.get("espace_id")).isEmpty())throw error(HttpStatus.CONFLICT,"Le participant n’est plus membre actif du groupe.");
  }
  var project=jdbc.queryForMap("SELECT * FROM projet WHERE id=? FOR UPDATE",row.get("projet_id"));
  var p=jdbc.queryForMap("SELECT * FROM participation_projet WHERE id=? FOR UPDATE",id);
  long version=((Number)p.get("version")).longValue();
  if(body.status().equals(p.get("statut")) && body.reason().equals(p.get("motif")) && version==body.version()+1 && p.get("examinateur_id")!=null && ((Number)p.get("examinateur_id")).longValue()==uid)return read(id);
  if(!"PROPOSEE".equals(p.get("statut")) || version!=body.version())throw error(HttpStatus.CONFLICT,"Cette proposition a changé. Actualisez la liste.");
  if("ACCEPTEE".equals(body.status()) && (!Boolean.TRUE.equals(project.get("publie")) || Boolean.TRUE.equals(project.get("masque_moderation")) || !"APPROUVE".equals(project.get("statut"))))throw error(HttpStatus.CONFLICT,"Le projet doit être publié pour accepter une proposition.");
  if("REFUSEE".equals(body.status()) && body.reason().isBlank())throw error(HttpStatus.BAD_REQUEST,"Précisez le motif du refus.");
  jdbc.update("UPDATE participation_projet SET statut=?,motif=?,examinateur_id=?,version=version+1,date_modification=now() WHERE id=?",body.status(),body.reason(),uid,id);
  history(id,uid,body.status(),body.reason());return read(id);
 }
}
