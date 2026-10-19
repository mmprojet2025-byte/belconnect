package be.belconnect.backend.workspace;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
public class StripeSubscriptionWebhookController {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final String secret;
  public StripeSubscriptionWebhookController(JdbcTemplate jdbc,ObjectMapper json,
      @Value("${STRIPE_SUBSCRIPTION_WEBHOOK_SECRET:}") String secret) {
    this.jdbc=jdbc; this.json=json; this.secret=secret;
  }
  private static String value(JsonNode n,String key) {
    JsonNode v=n==null?null:n.get(key);
    return v==null || v.isNull()?"":v.asText();
  }
  private static OffsetDateTime periodEnd(JsonNode n) {
    JsonNode v=n.get("current_period_end");
    return v!=null && v.isNumber()?OffsetDateTime.ofInstant(java.time.Instant.ofEpochSecond(v.asLong()),ZoneOffset.UTC):null;
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
      var rows=jdbc.queryForList("SELECT session_stripe,statut,abonnement_stripe FROM abonnement_espace WHERE espace_id=? FOR UPDATE",space);
      if(rows.isEmpty() || !session.equals(rows.getFirst().get("session_stripe"))) return;
      if(rows.getFirst().get("abonnement_stripe")!=null && !subscription.equals(rows.getFirst().get("abonnement_stripe"))) return;
      jdbc.update("""
        UPDATE abonnement_espace SET client_stripe=?,abonnement_stripe=?,formule='PRO',statut='ACTIF',date_modification=now()
        WHERE espace_id=?
        """,customer,subscription,space);
      return;
    }
    if("checkout.session.expired".equals(type) && "checkout.session".equals(value(object,"object"))) {
      jdbc.update("UPDATE abonnement_espace SET statut='ANNULE',date_modification=now() WHERE session_stripe=? AND abonnement_stripe IS NULL",
        value(object,"id"));
      return;
    }
    if(("customer.subscription.updated".equals(type) || "customer.subscription.deleted".equals(type))
        && "subscription".equals(value(object,"object"))) {
      String subscription=value(object,"id"),status=value(object,"status");
      String mapped="active".equals(status)?"ACTIF": "past_due".equals(status) || "unpaid".equals(status)?"PAIEMENT_ECHOUE":"ANNULE";
      if("customer.subscription.deleted".equals(type)) mapped="ANNULE";
      jdbc.update("""
        UPDATE abonnement_espace SET statut=?,formule=?,fin_periode=COALESCE(?,fin_periode),date_modification=now()
        WHERE abonnement_stripe=?
        """,mapped,"ACTIF".equals(mapped)?"PRO":"STARTER",periodEnd(object),subscription);
    }
  }
}
