package be.belconnect.backend.booking;

import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Recovers a paid Checkout result if Stripe's webhook was delayed or missed. */
@Component
public class PaidActivityReconciliation {
  private static final Logger log=LoggerFactory.getLogger(PaidActivityReconciliation.class);
  private final JdbcTemplate jdbc;
  private final PaidActivitySettlement settlement;
  private final String key;
  public PaidActivityReconciliation(JdbcTemplate jdbc,PaidActivitySettlement settlement,
      @Value("${STRIPE_SECRET_KEY:}") String key) {
    this.jdbc=jdbc; this.settlement=settlement; this.key=key;
  }

  @Scheduled(initialDelayString="${belconnect.paid-activity-reconciliation.initial-delay-ms:60000}",
      fixedDelayString="${belconnect.paid-activity-reconciliation.delay-ms:300000}")
  public void reconcile() {
    if(!key.startsWith("sk_test_")) return;
    var options=RequestOptions.builder().setApiKey(key).build();
    Integer missing=jdbc.queryForObject("""
      SELECT count(*) FROM reservation_payante_activite
      WHERE statut='EN_ATTENTE' AND session_stripe IS NULL AND date_creation < now()-interval '40 minutes'
      """,Integer.class);
    if(missing!=null && missing>0)
      log.warn("{} réservation(s) payante(s) sans session Stripe enregistrée ; examen nécessaire",missing);
    var attempts=jdbc.queryForList("""
      SELECT id,session_stripe FROM reservation_payante_activite
      WHERE statut='EN_ATTENTE' AND session_stripe IS NOT NULL AND date_creation < now()-interval '2 minutes'
      ORDER BY date_creation LIMIT 100
      """);
    for(var attempt:attempts) {
      long id=((Number)attempt.get("id")).longValue();
      String sessionId=(String)attempt.get("session_stripe");
      if(sessionId==null) {
        // A Checkout create may have succeeded before its session ID could be saved.
        // Never release such a hold without a verified Stripe result.
        continue;
      }
      try {
        Session session=Session.retrieve(sessionId,options);
        if(!Boolean.FALSE.equals(session.getLivemode()) || !sessionId.equals(session.getId())
            || !("activity-booking-"+id).equals(session.getClientReferenceId())) {
          log.error("Session Stripe incohérente pour la réservation {}",id);
          continue;
        }
        if("open".equals(session.getStatus()) && session.getExpiresAt()!=null
            && session.getExpiresAt()<=System.currentTimeMillis()/1000) session=session.expire(options);
        String event="complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())
          ? "checkout.session.completed"
          : "expired".equals(session.getStatus()) ? "checkout.session.expired" : "";
        if(!event.isEmpty()) settlement.apply(id,session.getId(),session.getClientReferenceId(),
          session.getAmountTotal()==null?-1:session.getAmountTotal(),session.getCurrency(),
          session.getPaymentStatus(),session.getPaymentIntent(),event);
      } catch(StripeException ex) {
        log.warn("Reprise Stripe impossible pour la réservation {} ; nouvel essai programmé",id);
      } catch(RuntimeException ex) {
        log.error("Reprise de la réservation {} impossible ; nouvel essai programmé",id,ex);
      }
    }
  }
}
