package be.belconnect.backend.project;

import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Recovers project Checkout outcomes that were not delivered by webhook. */
@Component
public class ProjectPaymentReconciliation {
  private static final Logger log=LoggerFactory.getLogger(ProjectPaymentReconciliation.class);
  private final JdbcTemplate jdbc;
  private final ProjectPaymentSettlement settlement;
  private final String key;
  public ProjectPaymentReconciliation(JdbcTemplate jdbc,ProjectPaymentSettlement settlement,
      @Value("${STRIPE_SECRET_KEY:}") String key) {
    this.jdbc=jdbc; this.settlement=settlement; this.key=key;
  }

  @Scheduled(initialDelayString="${belconnect.project-payment-reconciliation.initial-delay-ms:60000}",
      fixedDelayString="${belconnect.project-payment-reconciliation.delay-ms:300000}")
  public void reconcile() {
    if(!key.startsWith("sk_test_")) return;
    var options=RequestOptions.builder().setApiKey(key).build();
    for(String table:new String[]{"don_projet","inscription_payante_projet"}) {
      Integer missing=jdbc.queryForObject("SELECT count(*) FROM "+table+
        " WHERE statut='EN_ATTENTE' AND session_stripe IS NULL AND date_creation < now()-interval '40 minutes'",Integer.class);
      if(missing!=null && missing>0) log.error("{} tentative(s) {} sans session Stripe ; examen manuel nécessaire",missing,table);
    }
    reconcileTable("don_projet",false,options);
    reconcileTable("inscription_payante_projet",true,options);
  }

  private void reconcileTable(String table,boolean participation,RequestOptions options) {
    var attempts=jdbc.queryForList("SELECT id,session_stripe FROM "+table+
      " WHERE session_stripe IS NOT NULL AND date_creation < now()-interval '2 minutes'"+
      " AND (statut='EN_ATTENTE' OR statut IN ('EXPIRE','ECHOUE')) ORDER BY date_creation LIMIT 100");
    for(var attempt:attempts) {
      long id=((Number)attempt.get("id")).longValue();
      String sessionId=(String)attempt.get("session_stripe");
      try {
        Session session=Session.retrieve(sessionId,options);
        String expected=participation?"project-participation-"+id:String.valueOf(id);
        if(!Boolean.FALSE.equals(session.getLivemode()) || !sessionId.equals(session.getId())
            || !expected.equals(session.getClientReferenceId()) || session.getAmountTotal()==null
            || !"eur".equals(session.getCurrency())) {
          log.error("Session Stripe incohérente pour {} {}",table,id);
          continue;
        }
        if("open".equals(session.getStatus()) && session.getExpiresAt()!=null
            && session.getExpiresAt()<=System.currentTimeMillis()/1000) session=session.expire(options);
        String event="complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())
          ? "checkout.session.completed"
          : "expired".equals(session.getStatus()) ? "checkout.session.expired" : "";
        if(event.isEmpty()) continue;
        if(participation) settlement.paidParticipation(id,session.getId(),session.getAmountTotal(),
          session.getCurrency(),session.getPaymentStatus(),session.getPaymentIntent(),event);
        else settlement.donation(id,session.getId(),session.getAmountTotal(),session.getCurrency(),
          session.getPaymentStatus(),session.getPaymentIntent(),event);
      } catch(StripeException ex) {
        log.warn("Reprise Stripe impossible pour {} {} ; nouvel essai programmé",table,id);
      } catch(RuntimeException ex) {
        log.error("Reprise Stripe impossible pour {} {} ; nouvel essai programmé",table,id,ex);
      }
    }
  }
}
