package be.belconnect.backend.workspace;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace")
public class ProUpgradeRequestController {
  private final JdbcTemplate jdbc;
  public ProUpgradeRequestController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  public record Request(long spaceId, String spaceName, String applicant, String status,
                        OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
  private long account(Authentication auth) {
    if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'", (r,n)->r.getLong(1),auth.getName())
      .stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));
  }
  private void admin(long account,long space) {
    if (!Boolean.TRUE.equals(jdbc.queryForObject("""
      SELECT EXISTS(SELECT 1 FROM espace_organisateur e JOIN appartenance_espace a ON a.espace_id=e.id
        WHERE e.id=? AND e.statut='ACTIF' AND a.utilisateur_id=? AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF')
      """,Boolean.class,space,account))) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Espace introuvable.");
  }
  private void owner(long account) {
    if (!Boolean.TRUE.equals(jdbc.queryForObject(
      "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",Boolean.class,account)))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Accès réservé au propriétaire.");
  }
  private List<Request> requests(String where,Object... args) {
    return jdbc.query("""
      SELECT d.espace_id,e.nom AS espace_nom,u.prenom,u.nom,d.statut,d.date_creation,d.date_maj
      FROM demande_passage_pro d JOIN espace_organisateur e ON e.id=d.espace_id
      JOIN utilisateur u ON u.id=d.demandeur_id
      """+where+" ORDER BY d.date_creation DESC",(r,n)->new Request(r.getLong("espace_id"),r.getString("espace_nom"),
      r.getString("prenom")+" "+r.getString("nom"),r.getString("statut"),
      r.getObject("date_creation",OffsetDateTime.class),r.getObject("date_maj",OffsetDateTime.class)),args);
  }
  @GetMapping("/spaces/{spaceId}/pro-request")
  public Request mine(Authentication auth,@PathVariable long spaceId) {
    admin(account(auth),spaceId);
    return requests("WHERE d.espace_id=?",spaceId).stream().findFirst()
      .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Aucune demande Pro."));
  }
  @PostMapping("/spaces/{spaceId}/pro-request") @ResponseStatus(HttpStatus.CREATED) @Transactional
  public Request create(Authentication auth,@PathVariable long spaceId) {
    long account=account(auth);
    jdbc.query("SELECT id FROM espace_organisateur WHERE id=? FOR UPDATE",(r,n)->r.getLong(1),spaceId);
    admin(account,spaceId);
    if (Boolean.TRUE.equals(jdbc.queryForObject("""
      SELECT EXISTS(SELECT 1 FROM abonnement_espace WHERE espace_id=? AND formule='PRO' AND statut='ACTIF')
      """,Boolean.class,spaceId))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Cet espace est déjà en Pro.");
    jdbc.update("""
      INSERT INTO demande_passage_pro(espace_id,demandeur_id) VALUES (?,?) ON CONFLICT (espace_id) DO NOTHING
      """,spaceId,account);
    return requests("WHERE d.espace_id=?",spaceId).getFirst();
  }
  @GetMapping("/owner/pro-requests")
  public List<Request> ownerRequests(Authentication auth) {
    owner(account(auth));
    return requests("");
  }
  @PostMapping("/owner/pro-requests/{spaceId}/take") @Transactional
  public Request take(Authentication auth,@PathVariable long spaceId) {
    owner(account(auth));
    int changed=jdbc.update("""
      UPDATE demande_passage_pro SET statut='PRISE_EN_CHARGE',date_maj=now() WHERE espace_id=?
      """,spaceId);
    if(changed==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Demande introuvable.");
    return requests("WHERE d.espace_id=?",spaceId).getFirst();
  }
}
