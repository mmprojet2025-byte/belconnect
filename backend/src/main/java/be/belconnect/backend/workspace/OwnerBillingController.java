package be.belconnect.backend.workspace;

import com.stripe.exception.StripeException;
import com.stripe.model.Invoice;
import com.stripe.net.RequestOptions;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace/owner")
public class OwnerBillingController {
  private final JdbcTemplate jdbc;
  private final String stripeKey;

  public OwnerBillingController(JdbcTemplate jdbc, @Value("${STRIPE_SECRET_KEY:}") String stripeKey) {
    this.jdbc=jdbc;
    this.stripeKey=stripeKey;
  }

  public record Subscription(long spaceId,String spaceName,String spaceStatus,String administrator,
      String plan,String status,OffsetDateTime periodEnd,OffsetDateTime updatedAt,boolean stripeLinked) {}
  public record Bill(String id,String number,String spaceName,String status,long amountDueCents,
      long amountPaidCents,String currency,long createdAt,String hostedUrl,String pdfUrl) {}
  public record Bills(List<Bill> items,String nextCursor,boolean stripeConfigured) {}

  private void requireOwner(Authentication auth) {
    if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous connecter.");
    Boolean owner=jdbc.queryForObject("""
        SELECT EXISTS(SELECT 1 FROM role_plateforme r JOIN utilisateur u ON u.id=r.utilisateur_id
          WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE')
        """,Boolean.class,auth.getName());
    if(!Boolean.TRUE.equals(owner)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Accès réservé au propriétaire.");
  }

  @GetMapping("/subscriptions")
  public ResponseEntity<List<Subscription>> subscriptions(Authentication auth) {
    requireOwner(auth);
    var rows=jdbc.query("""
        SELECT e.id,e.nom,e.statut AS espace_statut,COALESCE(u.prenom || ' ','') || u.nom AS administrateur,
          COALESCE(a.formule,'STARTER') AS formule,COALESCE(a.statut,'GRATUIT') AS abonnement_statut,
          a.fin_periode,a.date_modification,a.client_stripe
        FROM espace_organisateur e
        LEFT JOIN abonnement_espace a ON a.espace_id=e.id
        LEFT JOIN utilisateur u ON u.id=a.administrateur_id
        WHERE NOT EXISTS (SELECT 1 FROM utilisateur creator WHERE creator.id=e.createur_id
          AND creator.email='belconnect-demo-projects@example.invalid')
        ORDER BY e.nom,e.id
        """,(r,n)->new Subscription(r.getLong("id"),r.getString("nom"),r.getString("espace_statut"),
          r.getString("administrateur"),r.getString("formule"),r.getString("abonnement_statut"),
          r.getObject("fin_periode",OffsetDateTime.class),r.getObject("date_modification",OffsetDateTime.class),
          r.getString("client_stripe")!=null));
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(rows);
  }

  @GetMapping("/invoices")
  public ResponseEntity<Bills> invoices(Authentication auth,@RequestParam(required=false) String cursor) {
    requireOwner(auth);
    if(!stripeKey.startsWith("sk_test_"))
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Bills(List.of(),null,false));
    if(cursor!=null && !cursor.matches("in_[A-Za-z0-9]+"))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Curseur de factures invalide.");
    Map<String,String> spaces=new HashMap<>();
    jdbc.query("""
        SELECT a.client_stripe,e.nom FROM abonnement_espace a JOIN espace_organisateur e ON e.id=a.espace_id
        WHERE a.client_stripe IS NOT NULL
        """,r->{spaces.put(r.getString(1),r.getString(2));});
    Map<String,Object> params=new HashMap<>();
    params.put("limit",50);
    if(cursor!=null) params.put("starting_after",cursor);
    try {
      var page=Invoice.list(params,RequestOptions.builder().setApiKey(stripeKey).build());
      var items=page.getData().stream().map(i->new Bill(i.getId(),i.getNumber(),
          spaces.getOrDefault(i.getCustomer(),"Espace non identifié"),i.getStatus(),
          i.getAmountDue()==null?0:i.getAmountDue(),i.getAmountPaid()==null?0:i.getAmountPaid(),
          i.getCurrency(),i.getCreated()==null?0:i.getCreated(),i.getHostedInvoiceUrl(),i.getInvoicePdf())).toList();
      String next=page.getHasMore() && !page.getData().isEmpty()?page.getData().getLast().getId():null;
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Bills(items,next,true));
    } catch(StripeException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Les factures Stripe sont momentanément indisponibles.");
    }
  }
}
