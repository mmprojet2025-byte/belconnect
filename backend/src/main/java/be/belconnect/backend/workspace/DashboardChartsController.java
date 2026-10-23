package be.belconnect.backend.workspace;

import java.time.LocalDate;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace/charts")
public class DashboardChartsController {
  private final JdbcTemplate jdbc;
  public DashboardChartsController(JdbcTemplate jdbc) { this.jdbc=jdbc; }

  public record Month(LocalDate month,long activityCents,long projectCents,long donationCents) {}
  public record Activity(long id,String title,int capacity,int remaining,int confirmedPlaces) {}
  public record SpaceCharts(List<Activity> activities,List<Month> months) {}

  private long activeUser(Authentication auth) {
    if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous connecter.");
    return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",
        (r,n)->r.getLong(1),auth.getName()).stream().findFirst()
        .orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
  }

  private String monthlySql(String amount,String spaceFilter) {
    return """
      WITH months AS (SELECT generate_series(date_trunc('month',now()) - interval '5 months',
        date_trunc('month',now()),interval '1 month') AS month),
      payments AS (
        SELECT date_trunc('month',r.date_paiement) AS month, r.%s AS cents,'activity' AS kind
          FROM reservation_payante_activite r JOIN activite a ON a.id=r.activite_id
          JOIN espace_organisateur e ON e.id=a.espace_id JOIN utilisateur u ON u.id=e.createur_id
          WHERE r.statut='PAYE' AND r.date_paiement>=date_trunc('month',now())-interval '5 months'
            AND u.email<>'belconnect-demo-projects@example.invalid' %s
        UNION ALL
        SELECT date_trunc('month',i.date_paiement),i.%s,'project'
          FROM inscription_payante_projet i JOIN projet p ON p.id=i.projet_id
          JOIN espace_organisateur e ON e.id=p.espace_id JOIN utilisateur u ON u.id=e.createur_id
          WHERE i.statut='PAYE' AND i.date_paiement>=date_trunc('month',now())-interval '5 months'
            AND u.email<>'belconnect-demo-projects@example.invalid' %s
        UNION ALL
        SELECT date_trunc('month',d.date_paiement),d.%s,'donation'
          FROM don_projet d JOIN projet p ON p.id=d.projet_id
          JOIN espace_organisateur e ON e.id=p.espace_id JOIN utilisateur u ON u.id=e.createur_id
          WHERE d.statut='PAYE' AND d.date_paiement>=date_trunc('month',now())-interval '5 months'
            AND u.email<>'belconnect-demo-projects@example.invalid' %s
      )
      SELECT months.month::date AS month,
        COALESCE(sum(payments.cents) FILTER (WHERE kind='activity'),0) AS activities,
        COALESCE(sum(payments.cents) FILTER (WHERE kind='project'),0) AS projects,
        COALESCE(sum(payments.cents) FILTER (WHERE kind='donation'),0) AS donations
      FROM months LEFT JOIN payments ON payments.month=months.month
      GROUP BY months.month ORDER BY months.month
      """.formatted(amount,spaceFilter,
        "montant_centimes".equals(amount)?"prix_centimes":amount,spaceFilter,amount,spaceFilter);
  }

  private List<Month> months(String amount,String filter,Object... args) {
    return jdbc.query(monthlySql(amount,filter),(r,n)->new Month(r.getObject("month",LocalDate.class),
      r.getLong("activities"),r.getLong("projects"),r.getLong("donations")),args);
  }

  @GetMapping("/owner") @Transactional(readOnly=true)
  public ResponseEntity<List<Month>> owner(Authentication auth) {
    long user=activeUser(auth);
    if(!Boolean.TRUE.equals(jdbc.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",
        Boolean.class,user))) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Accès réservé au propriétaire.");
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(months("commission_centimes",""));
  }

  @GetMapping("/spaces/{spaceId}") @Transactional(readOnly=true)
  public ResponseEntity<SpaceCharts> space(Authentication auth,@PathVariable long spaceId) {
    long user=activeUser(auth);
    if(!Boolean.TRUE.equals(jdbc.queryForObject("""
        SELECT EXISTS(SELECT 1 FROM appartenance_espace ae JOIN espace_organisateur e ON e.id=ae.espace_id
          WHERE ae.utilisateur_id=? AND ae.espace_id=? AND ae.role='ADMINISTRATEUR'
            AND ae.statut='ACTIF' AND e.statut='ACTIF')
        """,Boolean.class,user,spaceId)))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Cet espace n’est pas accessible.");
    List<Activity> activities=jdbc.query("""
        SELECT a.id,a.titre,a.capacite,a.places_disponibles,
          COALESCE((SELECT sum(i.quantite) FROM inscription_activite i
            WHERE i.activite_id=a.id AND i.statut='CONFIRMEE'),0) AS confirmed
        FROM activite a WHERE a.espace_id=? AND a.publiee AND NOT a.annulee AND a.debut>now()
        ORDER BY a.debut,a.id LIMIT 5
        """,(r,n)->new Activity(r.getLong("id"),r.getString("titre"),r.getInt("capacite"),
          r.getInt("places_disponibles"),r.getInt("confirmed")),spaceId);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
        new SpaceCharts(activities,months("montant_centimes","AND e.id=?",spaceId,spaceId,spaceId)));
  }
}
