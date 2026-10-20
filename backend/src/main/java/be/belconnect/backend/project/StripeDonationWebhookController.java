package be.belconnect.backend.project;

import be.belconnect.backend.booking.PaidActivitySettlement;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
public class StripeDonationWebhookController {
  private static final Set<String> EVENTS=Set.of("checkout.session.completed",
    "checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","checkout.session.expired");
  private final ObjectMapper json;
  private final String webhookSecret;
  private final PaidActivitySettlement activitySettlement;
  private final ProjectPaymentSettlement projectSettlement;
  public StripeDonationWebhookController(ObjectMapper json,
      @Value("${STRIPE_WEBHOOK_SECRET:}") String webhookSecret,PaidActivitySettlement activitySettlement,
      ProjectPaymentSettlement projectSettlement) {
    this.json=json; this.webhookSecret=webhookSecret; this.activitySettlement=activitySettlement;
    this.projectSettlement=projectSettlement;
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
    projectSettlement.donation(id,text(object,"id"),number(object,"amount_total"),text(object,"currency"),
      text(object,"payment_status"),text(object,"payment_intent"),event.getType());
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
    projectSettlement.paidParticipation(id,text(object,"id"),number(object,"amount_total"),text(object,"currency"),
      text(object,"payment_status"),text(object,"payment_intent"),type);
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
