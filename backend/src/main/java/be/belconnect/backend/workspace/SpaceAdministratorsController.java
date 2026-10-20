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
@RequestMapping("/api/workspace/spaces/{spaceId}/administrators")
public class SpaceAdministratorsController {
  private final JdbcTemplate jdbc;
  public SpaceAdministratorsController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  public record Member(long id,String name,String email,String role) {}
  public record Change(@NotNull Long memberId,@NotBlank @Size(min=10,max=1000) String reason) {}
  public record Recovery(@NotBlank @Email String email,@NotBlank @Size(min=10,max=1000) String reason) {}
  private ResponseStatusException error(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
  private long user(Authentication auth) {
    return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName())
      .stream().findFirst().orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
  }
  private boolean owner(long actor) {
    return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",Boolean.class,actor));
  }
  private boolean admin(long actor,long space) {
    return Boolean.TRUE.equals(jdbc.queryForObject("""
      SELECT EXISTS(SELECT 1 FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?
        AND role='ADMINISTRATEUR' AND statut='ACTIF')
      """,Boolean.class,actor,space));
  }
  private List<Member> members(long space) {
    return jdbc.query("""
      SELECT u.id,u.prenom,u.nom,u.email,a.role FROM appartenance_espace a
      JOIN utilisateur u ON u.id=a.utilisateur_id
      WHERE a.espace_id=? AND a.statut='ACTIF' AND u.statut='ACTIF'
      ORDER BY CASE WHEN a.role='ADMINISTRATEUR' THEN 0 ELSE 1 END,u.nom,u.prenom,u.id
      """,(r,n)->new Member(r.getLong("id"),(r.getString("prenom")+" "+r.getString("nom")).strip(),
        r.getString("email"),r.getString("role")),space);
  }
  @GetMapping @Transactional(readOnly=true)
  public List<Member> list(Authentication auth,@PathVariable long spaceId) {
    long actor=user(auth);
    if(!admin(actor,spaceId) && !owner(actor)) throw error(HttpStatus.FORBIDDEN,"Accès réservé aux administrateurs de cet espace.");
    return members(spaceId);
  }
  @PostMapping @Transactional
  public List<Member> appoint(Authentication auth,@PathVariable long spaceId,@Valid @RequestBody Change body) {
    long actor=user(auth);
    if(body.reason().strip().length()<10) throw error(HttpStatus.BAD_REQUEST,"Précisez le motif de la désignation.");
    var spaces=jdbc.queryForList("SELECT statut FROM espace_organisateur WHERE id=? FOR UPDATE",spaceId);
    if(spaces.isEmpty() || !"ACTIF".equals(spaces.getFirst().get("statut"))) throw error(HttpStatus.CONFLICT,"Cet espace n’est pas actif.");
    boolean isOwner=owner(actor);
    if(!isOwner && !admin(actor,spaceId)) throw error(HttpStatus.FORBIDDEN,"Accès réservé aux administrateurs de cet espace.");
    var candidates=jdbc.queryForList("""
      SELECT a.role FROM appartenance_espace a JOIN utilisateur u ON u.id=a.utilisateur_id
      WHERE a.espace_id=? AND a.utilisateur_id=? AND a.statut='ACTIF' AND u.statut='ACTIF' FOR UPDATE OF a
      """,spaceId,body.memberId());
    if(candidates.isEmpty()) throw error(HttpStatus.CONFLICT,"Choisissez un membre actif de cet espace.");
    if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",Boolean.class,body.memberId())))
      throw error(HttpStatus.CONFLICT,"Le propriétaire ne peut pas administrer un espace.");
    if("ADMINISTRATEUR".equals(candidates.getFirst().get("role"))) return members(spaceId);
    if(isOwner && adminCount(spaceId)>0) throw error(HttpStatus.FORBIDDEN,"La récupération par le propriétaire est réservée aux espaces sans administrateur actif.");
    jdbc.update("UPDATE appartenance_espace SET role='ADMINISTRATEUR' WHERE espace_id=? AND utilisateur_id=?",spaceId,body.memberId());
    jdbc.update("""
      INSERT INTO historique_gestion_espace(espace_id,acteur_id,cible_utilisateur_id,action,version,motif)
      VALUES (?,?,?, ?,0,?)
      """,spaceId,actor,body.memberId(),isOwner?"ADMINISTRATEUR_RECUPERE":"ADMINISTRATEUR_DESIGNE",body.reason().strip());
    return members(spaceId);
  }
  private int adminCount(long space) {
    return jdbc.queryForObject("""
      SELECT count(*) FROM appartenance_espace a JOIN utilisateur u ON u.id=a.utilisateur_id
      WHERE a.espace_id=? AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF' AND u.statut='ACTIF'
      """,Integer.class,space);
  }
  @PostMapping("/recovery") @Transactional
  public List<Member> recover(Authentication auth,@PathVariable long spaceId,@Valid @RequestBody Recovery body) {
    long actor=user(auth);
    if(!owner(actor)) throw error(HttpStatus.FORBIDDEN,"Récupération réservée au propriétaire.");
    String reason=body.reason().strip();
    if(reason.length()<10) throw error(HttpStatus.BAD_REQUEST,"Précisez le motif de récupération.");
    var spaces=jdbc.queryForList("SELECT statut FROM espace_organisateur WHERE id=? FOR UPDATE",spaceId);
    if(spaces.isEmpty() || !"ACTIF".equals(spaces.getFirst().get("statut"))) throw error(HttpStatus.CONFLICT,"Cet espace n’est pas actif.");
    if(adminCount(spaceId)>0) throw error(HttpStatus.CONFLICT,"Cet espace a déjà un administrateur actif.");
    String email=body.email().strip().toLowerCase(java.util.Locale.ROOT);
    var ids=jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),email);
    if(ids.isEmpty()) throw error(HttpStatus.CONFLICT,"Le compte de remplacement doit être actif.");
    long target=ids.getFirst();
    if(owner(target)) throw error(HttpStatus.CONFLICT,"Le propriétaire ne peut pas administrer un espace.");
    var membership=jdbc.queryForList("SELECT statut FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=? FOR UPDATE",target,spaceId);
    if(!membership.isEmpty() && !"ACTIF".equals(membership.getFirst().get("statut")))
      throw error(HttpStatus.CONFLICT,"Ce compte a une ancienne appartenance suspendue ou retirée. Examinez son dossier avant toute désignation.");
    if(membership.isEmpty()) jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",target,spaceId);
    else jdbc.update("UPDATE appartenance_espace SET role='ADMINISTRATEUR' WHERE utilisateur_id=? AND espace_id=?",target,spaceId);
    jdbc.update("""
      INSERT INTO historique_gestion_espace(espace_id,acteur_id,cible_utilisateur_id,action,version,motif)
      VALUES (?,?,?,'ADMINISTRATEUR_RECUPERE',0,?)
      """,spaceId,actor,target,reason);
    return members(spaceId);
  }
  @PostMapping("/leave") @Transactional
  public List<Member> leave(Authentication auth,@PathVariable long spaceId) {
    long actor=user(auth);
    jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? FOR UPDATE",spaceId);
    if(!admin(actor,spaceId)) throw error(HttpStatus.FORBIDDEN,"Vous n’administrez pas cet espace.");
    if(adminCount(spaceId)<2) throw error(HttpStatus.CONFLICT,"Désignez d’abord un autre administrateur actif.");
    jdbc.update("UPDATE appartenance_espace SET role='MEMBRE' WHERE espace_id=? AND utilisateur_id=?",spaceId,actor);
    jdbc.update("INSERT INTO historique_gestion_espace(espace_id,acteur_id,cible_utilisateur_id,action,version) VALUES (?,?,?,'ADMINISTRATEUR_PARTI',0)",spaceId,actor,actor);
    return members(spaceId);
  }
}
