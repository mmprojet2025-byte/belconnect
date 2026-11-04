package be.belconnect.backend.workspace;

import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/workspace/owner/dashboard")
public class OwnerDashboardController {
 private final JdbcTemplate jdbc;
 public OwnerDashboardController(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public record Summary(long openingRequests,long reports,long proRequests,long unmanagedSpaces,long suspendedSpaces,long pendingRefunds,long activeSpaces,long activeMembers){}
 @GetMapping @Transactional(readOnly=true)
 public ResponseEntity<Summary> summary(Authentication auth){
  if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM utilisateur u JOIN role_plateforme r ON r.utilisateur_id=u.id WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE')",Boolean.class,auth.getName())))throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  var summary=jdbc.queryForObject("""
   WITH spaces AS (SELECT e.* FROM espace_organisateur e JOIN utilisateur u ON u.id=e.createur_id WHERE u.email<>'belconnect-demo-projects@example.invalid')
   SELECT
    (SELECT count(*) FROM demande_espace WHERE statut='EN_ATTENTE') AS openings,
    (SELECT count(*) FROM signalement_message_prive WHERE date_traitement IS NULL) AS reports,
    (SELECT count(*) FROM demande_passage_pro d JOIN spaces e ON e.id=d.espace_id WHERE d.statut='EN_ATTENTE' AND e.statut='ACTIF') AS pro,
    (SELECT count(*) FROM spaces e WHERE e.statut='ACTIF' AND NOT EXISTS(SELECT 1 FROM appartenance_espace a JOIN utilisateur u ON u.id=a.utilisateur_id WHERE a.espace_id=e.id AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF' AND u.statut='ACTIF')) AS unmanaged,
    (SELECT count(*) FROM spaces WHERE statut='SUSPENDU') AS suspended,
    ((SELECT count(*) FROM reservation_payante_activite r JOIN activite a ON a.id=r.activite_id JOIN spaces e ON e.id=a.espace_id WHERE r.statut='REMBOURSEMENT_EN_COURS')+
     (SELECT count(*) FROM inscription_payante_projet i JOIN projet p ON p.id=i.projet_id JOIN spaces e ON e.id=p.espace_id WHERE i.statut='REMBOURSEMENT_EN_COURS')) AS refunds,
    (SELECT count(*) FROM spaces WHERE statut='ACTIF') AS active,
    (SELECT count(*) FROM utilisateur u WHERE u.statut='ACTIF' AND u.email<>'belconnect-demo-projects@example.invalid' AND NOT EXISTS(SELECT 1 FROM role_plateforme r WHERE r.utilisateur_id=u.id AND r.role='PROPRIETAIRE')) AS members
   """,(r,n)->new Summary(r.getLong("openings"),r.getLong("reports"),r.getLong("pro"),r.getLong("unmanaged"),r.getLong("suspended"),r.getLong("refunds"),r.getLong("active"),r.getLong("members")));
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(summary);
 }

 public record Alerts(long failedChecks,java.time.OffsetDateTime lastFailure,long failedPayments,long settledPayments,boolean paymentThreshold,java.time.OffsetDateTime checkedAt) {}
 @GetMapping("/alerts") @Transactional(readOnly=true)
 public ResponseEntity<Alerts> alerts(Authentication auth) {
  Long user=jdbc.query("SELECT u.id FROM utilisateur u JOIN role_plateforme r ON r.utilisateur_id=u.id WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN));
  var security=jdbc.queryForMap("SELECT count(*) AS failures,max(date_creation) AS latest FROM owner_security_event WHERE utilisateur_id=? AND evenement IN ('ECHEC','CONNEXION_REFUSEE') AND date_creation>=now()-interval '15 minutes'",user);
  var payments=jdbc.queryForMap("""
   WITH attempts AS (
    SELECT statut FROM reservation_payante_activite WHERE date_creation>=now()-interval '24 hours'
    UNION ALL SELECT statut FROM inscription_payante_projet WHERE date_creation>=now()-interval '24 hours'
   ) SELECT count(*) FILTER(WHERE statut='ECHOUE') AS failed,
    count(*) FILTER(WHERE statut IN ('ECHOUE','PAYE','REMBOURSE','REMBOURSEMENT_EN_COURS')) AS settled FROM attempts
   """);
  long failed=((Number)payments.get("failed")).longValue(), settled=((Number)payments.get("settled")).longValue();
  var last=jdbc.queryForObject("SELECT max(date_creation) FROM owner_security_event WHERE utilisateur_id=? AND evenement IN ('ECHEC','CONNEXION_REFUSEE') AND date_creation>=now()-interval '15 minutes'",java.time.OffsetDateTime.class,user);
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Alerts(((Number)security.get("failures")).longValue(),last,failed,settled,settled>=10&&failed*100>=settled*30,java.time.OffsetDateTime.now()));
 }
}
