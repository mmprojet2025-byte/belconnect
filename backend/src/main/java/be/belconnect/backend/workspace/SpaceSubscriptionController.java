package be.belconnect.backend.workspace;

import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.model.Price;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace/spaces/{spaceId}/subscription")
public class SpaceSubscriptionController {
  private final JdbcTemplate jdbc;
  private final String secret,webhook,priceId,publicUrl;
  public SpaceSubscriptionController(JdbcTemplate jdbc,
      @Value("${STRIPE_SECRET_KEY:}") String secret,
      @Value("${STRIPE_SUBSCRIPTION_WEBHOOK_SECRET:}") String webhook,
      @Value("${STRIPE_PRO_MONTHLY_PRICE_ID:}") String priceId,
      @Value("${APP_PUBLIC_URL:http://localhost:5173}") String publicUrl) {
    this.jdbc=jdbc; this.secret=secret; this.webhook=webhook; this.priceId=priceId;
    this.publicUrl=publicUrl.replaceAll("/+$","");
  }
  public record Status(String plan,String status,int monthlyPriceCents,OffsetDateTime periodEnd,boolean testCheckoutReady) {}
  public record Link(String url) {}
  public record CheckoutRequest(@NotNull UUID requestId) {}
  private ResponseStatusException fail(HttpStatus code,String message) { return new ResponseStatusException(code,message); }
  private long admin(Authentication auth,long spaceId) {
    if(auth==null) throw fail(HttpStatus.UNAUTHORIZED,"Veuillez vous connecter.");
    return jdbc.query("""
      SELECT u.id FROM utilisateur u JOIN appartenance_espace ae ON ae.utilisateur_id=u.id
      JOIN espace_organisateur e ON e.id=ae.espace_id
      WHERE e.id=? AND e.statut='ACTIF' AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF'
        AND u.email=? AND u.statut='ACTIF'
      """,(r,n)->r.getLong(1),spaceId,auth.getName()).stream().findFirst()
      .orElseThrow(()->fail(HttpStatus.NOT_FOUND,"Espace introuvable dans vos espaces administrés."));
  }
  private boolean ready() { return secret.startsWith("sk_test_") && webhook.startsWith("whsec_") && priceId.startsWith("price_"); }
  private RequestOptions options() {
    if(!ready()) throw fail(HttpStatus.SERVICE_UNAVAILABLE,"L'abonnement test n'est pas encore configuré.");
    return RequestOptions.builder().setApiKey(secret).build();
  }
  @GetMapping
  public ResponseEntity<Status> status(Authentication auth,@PathVariable long spaceId) {
    admin(auth,spaceId);
    var rows=jdbc.query("""
      SELECT formule,statut,fin_periode FROM abonnement_espace WHERE espace_id=?
      """,(r,n)->new Status("ACTIF".equals(r.getString("statut"))?"PRO":"STARTER",r.getString("statut"),1000,
        r.getObject("fin_periode",OffsetDateTime.class),ready()),spaceId);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(rows.isEmpty()?new Status("STARTER","GRATUIT",1000,null,ready()):rows.getFirst());
  }
  @PostMapping("/checkout") @Transactional
  public ResponseEntity<Link> checkout(Authentication auth,@PathVariable long spaceId,@Valid @RequestBody CheckoutRequest body) {
    long uid=admin(auth,spaceId);
    RequestOptions request=options();
    jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? FOR UPDATE",spaceId);
    var rows=jdbc.queryForList("SELECT * FROM abonnement_espace WHERE espace_id=?",spaceId);
    if(!rows.isEmpty()) {
      var row=rows.getFirst();
      if("ACTIF".equals(row.get("statut")) || "PAIEMENT_ECHOUE".equals(row.get("statut")) && row.get("abonnement_stripe")!=null)
        throw fail(HttpStatus.CONFLICT,"Un abonnement existe déjà. Ouvrez sa gestion Stripe.");
      if(row.get("session_stripe")!=null && row.get("abonnement_stripe")==null) {
        try {
          Session session=Session.retrieve((String)row.get("session_stripe"),request);
          if("open".equals(session.getStatus()) && session.getUrl()!=null)
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Link(session.getUrl()));
          if("complete".equals(session.getStatus())) throw fail(HttpStatus.CONFLICT,"Le paiement est en cours de confirmation. Actualisez la page.");
        } catch(StripeException ex) { throw fail(HttpStatus.BAD_GATEWAY,"Stripe est temporairement indisponible."); }
      }
    }
    try {
      Price price=Price.retrieve(priceId,request);
      if(!"eur".equals(price.getCurrency()) || !Long.valueOf(1000).equals(price.getUnitAmount())
          || price.getRecurring()==null || !"month".equals(price.getRecurring().getInterval())
          || !Long.valueOf(1).equals(price.getRecurring().getIntervalCount()))
        throw fail(HttpStatus.CONFLICT,"Le tarif Stripe configuré ne correspond pas à 10 € par mois.");
      var params=SessionCreateParams.builder().setMode(SessionCreateParams.Mode.SUBSCRIPTION)
        .setClientReferenceId("space-subscription-"+spaceId)
        .setCustomerEmail(auth.getName())
        .setSuccessUrl(publicUrl+"/mon-espace?abonnement=retour#espaces")
        .setCancelUrl(publicUrl+"/mon-espace?abonnement=annule#espaces")
        .addLineItem(SessionCreateParams.LineItem.builder().setPrice(priceId).setQuantity(1L).build())
        .build();
      Session session=Session.create(params,RequestOptions.builder().setApiKey(secret)
        .setIdempotencyKey("belconnect-space-subscription-"+spaceId+"-"+body.requestId()).build());
      if(session.getUrl()==null || !session.getUrl().startsWith("https://checkout.stripe.com/"))
        throw fail(HttpStatus.BAD_GATEWAY,"Lien Stripe invalide.");
      jdbc.update("""
        INSERT INTO abonnement_espace(espace_id,administrateur_id,session_stripe,demande)
        VALUES (?,?,?,?) ON CONFLICT(espace_id) DO UPDATE SET administrateur_id=excluded.administrateur_id,
          session_stripe=excluded.session_stripe,demande=excluded.demande,abonnement_stripe=NULL,
          statut='EN_ATTENTE',termine_definitivement=false,date_modification=now()
        """,spaceId,uid,session.getId(),body.requestId());
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Link(session.getUrl()));
    } catch(StripeException ex) { throw fail(HttpStatus.BAD_GATEWAY,"Stripe est temporairement indisponible."); }
  }
  @PostMapping("/portal")
  public ResponseEntity<Link> portal(Authentication auth,@PathVariable long spaceId) {
    admin(auth,spaceId);
    RequestOptions request=options();
    var customers=jdbc.query("SELECT client_stripe FROM abonnement_espace WHERE espace_id=? AND client_stripe IS NOT NULL",
      (r,n)->r.getString(1),spaceId);
    if(customers.isEmpty()) throw fail(HttpStatus.CONFLICT,"Aucun abonnement Stripe à gérer.");
    try {
      var params=com.stripe.param.billingportal.SessionCreateParams.builder().setCustomer(customers.getFirst())
        .setReturnUrl(publicUrl+"/mon-espace#espaces").build();
      var session=com.stripe.model.billingportal.Session.create(params,request);
      if(session.getUrl()==null || !session.getUrl().startsWith("https://billing.stripe.com/"))
        throw fail(HttpStatus.BAD_GATEWAY,"Lien Stripe invalide.");
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Link(session.getUrl()));
    } catch(StripeException ex) { throw fail(HttpStatus.BAD_GATEWAY,"Stripe est temporairement indisponible."); }
  }
}
