package be.belconnect.backend.project;

import be.belconnect.backend.booking.PaidActivitySettlement;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
public class StripeDonationWebhookController {
  private static final Set<String> EVENTS=Set.of("checkout.session.completed",
    "checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","checkout.session.expired");
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final String webhookSecret;
  private final PaidActivitySettlement activitySettlement;
  public StripeDonationWebhookController(JdbcTemplate jdbc,ObjectMapper json,
      @Value("${STRIPE_WEBHOOK_SECRET:}") String webhookSecret,PaidActivitySettlement activitySettlement) {
    this.jdbc=jdbc; this.json=json; this.webhookSecret=webhookSecret; this.activitySettlement=activitySettlement;
  }
  @PostMapping("/api/stripe/webhook") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
  public void receive(@RequestBody String payload,@RequestHeader(value="Stripe-Signature",required=false) String signature) {
    if(!webhookSecret.startsWith("whsec_"))
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Webhook Stripe non configuré.");
    if(signature==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Signature Stripe manquante.");
    Event event;
    try { event=Webhook.constructEvent(payload,signature,webhookSecret); }
    catch(SignatureVerificationException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Signature Stripe invalide."); }
    if(!EVENTS.contains(event.getType())) return;
    JsonNode root;
    JsonNode object;
    try { root=json.readTree(payload); object=root.get("data").get("object"); }
    catch(Exception ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Événement Stripe invalide."); }
    if(object==null || !"checkout.session".equals(text(object,"object"))) return;
    if(!"false".equals(text(root,"livemode"))) return;
    String reference=text(object,"client_reference_id");
    if(reference.startsWith("activity-booking-")) {
      paidActivity(reference,object,event.getType());
      return;
    }
    if(reference.startsWith("project-participation-")) {
      paidParticipation(reference,object,event.getType());
      return;
    }
    long id;
    try { id=Long.parseLong(text(object,"client_reference_id")); }
    catch(Exception ex) { return; }
    var rows=jdbc.queryForList("SELECT id,montant_centimes,devise,session_stripe,statut FROM don_projet WHERE id=? FOR UPDATE",id);
    if(rows.isEmpty()) return;
    var donation=rows.getFirst();
    String sessionId=text(object,"id");
    if(!sessionId.startsWith("cs_test_")) return;
    if(donation.get("session_stripe")!=null && !sessionId.equals(donation.get("session_stripe"))) return;
    if(((Number)donation.get("montant_centimes")).longValue()!=number(object,"amount_total")
        || !donation.get("devise").equals(text(object,"currency"))) return;
    String current=(String)donation.get("statut");
    if("PAYE".equals(current) || "REMBOURSE".equals(current)) return;
    String type=event.getType();
    if(("checkout.session.completed".equals(type) || "checkout.session.async_payment_succeeded".equals(type))
        && "paid".equals(text(object,"payment_status")) && text(object,"payment_intent").startsWith("pi_")) {
      jdbc.update("""
        UPDATE don_projet SET session_stripe=?,paiement_stripe=?,statut='PAYE',date_paiement=now()
        WHERE id=? AND statut<>'PAYE'
        """,sessionId,text(object,"payment_intent"),id);
    } else if("checkout.session.async_payment_failed".equals(type) || "checkout.session.expired".equals(type)) {
      jdbc.update("UPDATE don_projet SET session_stripe=?,statut=? WHERE id=? AND statut='EN_ATTENTE'",
        sessionId,"checkout.session.expired".equals(type)?"EXPIRE":"ECHOUE",id);
    }
  }
  private void paidActivity(String reference,JsonNode object,String type) {
    long id;
    try { id=Long.parseLong(reference.substring("activity-booking-".length())); }
    catch(NumberFormatException ex) { return; }
    activitySettlement.apply(id,text(object,"id"),reference,number(object,"amount_total"),text(object,"currency"),
      text(object,"payment_status"),text(object,"payment_intent"),type);
  }
  private void paidParticipation(String reference,JsonNode object,String type) {
    long id;
    try { id=Long.parseLong(reference.substring("project-participation-".length())); }
    catch(NumberFormatException ex) { return; }
    var rows=jdbc.queryForList("SELECT id,prix_centimes,session_stripe,statut FROM inscription_payante_projet WHERE id=? FOR UPDATE",id);
    if(rows.isEmpty()) return;
    var booking=rows.getFirst();
    String session=text(object,"id");
    if(!session.startsWith("cs_test_") || booking.get("session_stripe")!=null && !session.equals(booking.get("session_stripe"))) return;
    if(((Number)booking.get("prix_centimes")).longValue()!=number(object,"amount_total") || !"eur".equals(text(object,"currency"))) return;
    String status=(String)booking.get("statut");
    if(!"EN_ATTENTE".equals(status)) return;
    if(("checkout.session.completed".equals(type) || "checkout.session.async_payment_succeeded".equals(type))
        && "paid".equals(text(object,"payment_status")) && text(object,"payment_intent").startsWith("pi_")) {
      jdbc.update("UPDATE inscription_payante_projet SET session_stripe=?,paiement_stripe=?,statut='PAYE',date_paiement=now() WHERE id=? AND statut='EN_ATTENTE'",
        session,text(object,"payment_intent"),id);
    } else if("checkout.session.expired".equals(type) || "checkout.session.async_payment_failed".equals(type)) {
      jdbc.update("UPDATE inscription_payante_projet SET session_stripe=?,statut=? WHERE id=? AND statut='EN_ATTENTE'",
        session,"checkout.session.expired".equals(type)?"EXPIRE":"ECHOUE",id);
    }
  }
  private static String text(JsonNode node,String key) {
    JsonNode value=node==null?null:node.get(key);
    return value==null || value.isNull()?"":value.asText();
  }
  private static long number(JsonNode node,String key) {
    JsonNode value=node==null?null:node.get(key);
    return value==null || !value.isNumber()?-1:value.asLong();
  }
}
