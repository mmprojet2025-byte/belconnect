package be.belconnect.backend.workspace;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
@RestController
@RequestMapping("/api/workspace/member-interventions")
public class MemberInterventionController {
 private final JdbcTemplate jdbc;
 public MemberInterventionController(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public record Request(long spaceId,Long groupId,long memberId,String reason){}
 public record Decision(boolean approve,String reason){}
 private long user(Authentication a){return jdbc.queryForObject("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",Long.class,a.getName());}
 private boolean owner(long id){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",Boolean.class,id));}
 private boolean admin(long id,long space){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_espace a JOIN espace_organisateur e ON e.id=a.espace_id WHERE a.utilisateur_id=? AND a.espace_id=? AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF' AND e.statut='ACTIF')",Boolean.class,id,space));}
 private void reason(String r){if(r==null||r.strip().length()<10||r.length()>1000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Indiquez un motif de 10 à 1000 caractères.");}
 private void target(long space,Long group,long member){
  if(owner(member)||Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=? AND role='ADMINISTRATEUR')",Boolean.class,space,member)))throw new ResponseStatusException(HttpStatus.CONFLICT,"Utilisez le parcours administrateur pour ce compte.");
  String sql=group==null?"SELECT id FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=? AND statut='ACTIF' FOR UPDATE":"SELECT id FROM appartenance_groupe WHERE espace_id=? AND utilisateur_id=? AND groupe_id=? AND statut='ACTIF' FOR UPDATE";
  var ids=jdbc.queryForList(sql,group==null?new Object[]{space,member}:new Object[]{space,member,group});
  if(ids.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"L’appartenance n’est plus active dans ce périmètre.");
 }
 @GetMapping("/scopes") public ResponseEntity<Map<String,Object>> scopes(Authentication auth){
  if(!owner(user(auth)))throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("spaces",jdbc.queryForList("SELECT id,nom AS name FROM espace_organisateur ORDER BY nom,id"),"groups",jdbc.queryForList("SELECT id,espace_id AS space_id,nom AS name FROM groupe ORDER BY nom,id")));
 }
 @GetMapping public ResponseEntity<List<Map<String,Object>>> list(Authentication auth,@RequestParam(required=false) Long spaceId){
  long actor=user(auth);boolean isOwner=owner(actor);
  if(!isOwner&&(spaceId==null||!admin(actor,spaceId)))throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  var args=new ArrayList<Object>();String where="";
  if(spaceId!=null){where=" WHERE d.espace_id=?";args.add(spaceId);}
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(jdbc.queryForList("SELECT d.id,d.espace_id,d.groupe_id,d.cible_id,d.motif,d.statut,d.motif_decision,d.cree_le,d.decide_le,e.nom AS espace,g.nom AS groupe,concat_ws(' ',u.prenom,u.nom) AS membre FROM demande_intervention_membre d JOIN espace_organisateur e ON e.id=d.espace_id JOIN utilisateur u ON u.id=d.cible_id LEFT JOIN groupe g ON g.id=d.groupe_id"+where+" ORDER BY (d.statut='EN_ATTENTE') DESC,d.id DESC LIMIT 100",args.toArray()));
 }
 @PostMapping @Transactional public ResponseEntity<Void> create(Authentication auth,@RequestBody Request body){
  long actor=user(auth);if(!owner(actor))throw new ResponseStatusException(HttpStatus.FORBIDDEN);reason(body.reason());
  if(jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? AND statut='ACTIF' FOR UPDATE",body.spaceId()).isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"L’espace doit être actif.");target(body.spaceId(),body.groupId(),body.memberId());
  if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM appartenance_espace a JOIN utilisateur u ON u.id=a.utilisateur_id WHERE a.espace_id=? AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF' AND u.statut='ACTIF')",Boolean.class,body.spaceId())))throw new ResponseStatusException(HttpStatus.CONFLICT,"Aucun administrateur actif : rétablissez une administration avant de demander un accord.");
  int n=jdbc.update("INSERT INTO demande_intervention_membre(espace_id,groupe_id,cible_id,demandeur_id,motif) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",body.spaceId(),body.groupId(),body.memberId(),actor,body.reason().strip());
  if(n==0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Une demande est déjà en attente.");return ResponseEntity.status(201).build();
 }
 @PostMapping("/{id}/decision") @Transactional public ResponseEntity<Void> decide(Authentication auth,@PathVariable long id,@RequestBody Decision body){
  long actor=user(auth);
  var rows=jdbc.queryForList("SELECT * FROM demande_intervention_membre WHERE id=? FOR UPDATE",id);if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND);
  var d=rows.getFirst();long space=((Number)d.get("espace_id")).longValue();long member=((Number)d.get("cible_id")).longValue();Long group=d.get("groupe_id")==null?null:((Number)d.get("groupe_id")).longValue();
  jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? FOR UPDATE",space);
  if(owner(actor)||!admin(actor,space)||actor==member)throw new ResponseStatusException(HttpStatus.FORBIDDEN);reason(body.reason());
  if(!"EN_ATTENTE".equals(d.get("statut")))throw new ResponseStatusException(HttpStatus.CONFLICT,"Cette demande a déjà été examinée.");
  if(body.approve()){
   target(space,group,member);
   if(group==null)jdbc.update("UPDATE appartenance_espace SET statut='SUSPENDU' WHERE espace_id=? AND utilisateur_id=?",space,member);
   else jdbc.update("UPDATE appartenance_groupe SET statut='SUSPENDU' WHERE espace_id=? AND groupe_id=? AND utilisateur_id=?",space,group,member);
  }
  jdbc.update("UPDATE demande_intervention_membre SET statut=?,decideur_id=?,motif_decision=?,decide_le=now() WHERE id=?",body.approve()?"APPROUVEE":"REFUSEE",actor,body.reason().strip(),id);
  return ResponseEntity.noContent().build();
 }
}
