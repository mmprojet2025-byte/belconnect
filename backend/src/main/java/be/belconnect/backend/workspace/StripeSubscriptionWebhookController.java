package be.belconnect.backend.workspace;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.Subscription;
import com.stripe.exception.StripeException;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
public class StripeSubscriptionWebhookController {
  private static final Logger log=LoggerFactory.getLogger(StripeSubscriptionWebhookController.class);
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final String secret;
  private final String key;
  public StripeSubscriptionWebhookController(JdbcTemplate jdbc,ObjectMapper json,
      @Value("${STRIPE_SUBSCRIPTION_WEBHOOK_SECRET:}") String secret,
      @Value("${STRIPE_SECRET_KEY:}") String key) {
    this.jdbc=jdbc; this.json=json; this.secret=secret; this.key=key;
  }
  private static String value(JsonNode n,String key) {
    JsonNode v=n==null?null:n.get(key);
    return v==null || v.isNull()?"":v.asText();
  }
  private static OffsetDateTime periodEnd(JsonNode n) {
    JsonNode v=n.get("current_period_end");
    return v!=null && v.isNumber()?OffsetDateTime.ofInstant(java.time.Instant.ofEpochSecond(v.asLong()),ZoneOffset.UTC):null;
  }
  private String currentStatus(String subscription,String eventStatus) {
    // An event is a notification, not the current state: Stripe can resend it out of order.
    if(!key.startsWith("sk_test_")) return eventStatus;
    try {
      Subscription current=Subscription.retrieve(subscription,RequestOptions.builder().setApiKey(key).build());
      if(!subscription.equals(current.getId()) || !Boolean.FALSE.equals(current.getLivemode()))
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Abonnement Stripe incohérent.");
      return current.getStatus();
    } catch(StripeException ex) {
      // Return non-2xx so Stripe retries after a temporary API failure.
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Impossible de vérifier l'abonnement Stripe.");
    }
  }
  private static String mappedStatus(String status) {
    return "active".equals(status) ? "ACTIF"
      : "past_due".equals(status) || "unpaid".equals(status) ? "PAIEMENT_ECHOUE":"ANNULE";
  }
  /** Stripe remains authoritative if a subscription webhook was delayed or lost. */
  @Scheduled(initialDelayString="${belconnect.subscription-reconciliation.initial-delay-ms:90000}",
      fixedDelayString="${belconnect.subscription-reconciliation.delay-ms:300000}")
  public void reconcile() {
    if(!key.startsWith("sk_test_")) return;
    var rows=jdbc.queryForList("""
      SELECT espace_id,abonnement_stripe FROM abonnement_espace
      WHERE abonnement_stripe IS NOT NULL AND termine_definitivement=false
      ORDER BY date_modification LIMIT 100
      """);
    for(var row:rows) {
      long space=((Number)row.get("espace_id")).longValue();
      String subscription=(String)row.get("abonnement_stripe");
      try {
        String current=currentStatus(subscription,"");
        String mapped=mappedStatus(current);
        jdbc.update("""
          UPDATE abonnement_espace SET statut=?,formule=?,termine_definitivement=?,date_modification=now()
          WHERE espace_id=? AND abonnement_stripe=? AND termine_definitivement=false
          """,mapped,"ACTIF".equals(mapped)?"PRO":"STARTER","canceled".equals(current),space,subscription);
      } catch(RuntimeException ex) { log.warn("Synchronisation de l'abonnement de l'espace {} impossible ; nouvel essai programmé",space,ex); }
    }
  }
  @PostMapping("/api/stripe/subscriptions/webhook") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
  public void receive(@RequestBody String payload,@RequestHeader(value="Stripe-Signature",required=false) String signature) {
    if(!secret.startsWith("whsec_")) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Webhook d'abonnement non configuré.");
    if(signature==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Signature Stripe manquante.");
    Event event;
    try { event=Webhook.constructEvent(payload,signature,secret); }
    catch(SignatureVerificationException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Signature Stripe invalide."); }
    JsonNode root, object;
    try { root=json.readTree(payload); object=root.get("data").get("object"); }
    catch(Exception ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Événement Stripe invalide."); }
    if(object==null || !"false".equals(value(root,"livemode"))) return;
    String type=event.getType();
    if("checkout.session.completed".equals(type) && "checkout.session".equals(value(object,"object"))) {
      String ref=value(object,"client_reference_id");
      if(!ref.startsWith("space-subscription-")) return;
      long space;
      try { space=Long.parseLong(ref.substring("space-subscription-".length())); }
      catch(NumberFormatException ex) { return; }
      String session=value(object,"id"),subscription=value(object,"subscription"),customer=value(object,"customer");
      if(!session.startsWith("cs_test_") || !subscription.startsWith("sub_") || !customer.startsWith("cus_")
          || !"subscription".equals(value(object,"mode")) || !"paid".equals(value(object,"payment_status"))
          || !"eur".equals(value(object,"currency")) || object.get("amount_subtotal")==null
          || object.get("amount_subtotal").asLong()!=1000) return;
      var rows=jdbc.queryForList("SELECT session_stripe,statut,abonnement_stripe,termine_definitivement FROM abonnement_espace WHERE espace_id=? FOR UPDATE",space);
      if(rows.isEmpty() || !session.equals(rows.getFirst().get("session_stripe"))) return;
      if(rows.getFirst().get("abonnement_stripe")!=null && !subscription.equals(rows.getFirst().get("abonnement_stripe"))) return;
      if(Boolean.TRUE.equals(rows.getFirst().get("termine_definitivement"))) return;
      String mapped=mappedStatus(currentStatus(subscription,"active"));
      jdbc.update("""
        UPDATE abonnement_espace SET client_stripe=?,abonnement_stripe=?,formule=?,statut=?,date_modification=now()
        WHERE espace_id=?
        """,customer,subscription,"ACTIF".equals(mapped)?"PRO":"STARTER",mapped,space);
      return;
    }
    if("checkout.session.expired".equals(type) && "checkout.session".equals(value(object,"object"))) {
      jdbc.update("UPDATE abonnement_espace SET statut='ANNULE',date_modification=now() WHERE session_stripe=? AND abonnement_stripe IS NULL",
        value(object,"id"));
      return;
    }
    if(("customer.subscription.updated".equals(type) || "customer.subscription.deleted".equals(type))
        && "subscription".equals(value(object,"object"))) {
      String subscription=value(object,"id");
      if(!subscription.startsWith("sub_")) return;
      var rows=jdbc.queryForList("SELECT termine_definitivement FROM abonnement_espace WHERE abonnement_stripe=? FOR UPDATE",subscription);
      if(rows.isEmpty() || Boolean.TRUE.equals(rows.getFirst().get("termine_definitivement"))) return;
      boolean deleted="customer.subscription.deleted".equals(type);
      String current=currentStatus(subscription,value(object,"status"));
      String mapped=deleted || "canceled".equals(current)?"ANNULE":mappedStatus(current);
      jdbc.update("""
        UPDATE abonnement_espace SET statut=?,formule=?,fin_periode=COALESCE(?,fin_periode),
          termine_definitivement=?,date_modification=now()
        WHERE abonnement_stripe=?
        """,mapped,"ACTIF".equals(mapped)?"PRO":"STARTER",periodEnd(object),deleted || "canceled".equals(current),subscription);
    }
  }
}
