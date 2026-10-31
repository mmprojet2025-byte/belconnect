package be.belconnect.backend.booking;

import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Closes every Checkout and reimburses every paid booking after an organizer cancels. */
@Service
public class PaidActivityCancellation {
  private static final Logger log=LoggerFactory.getLogger(PaidActivityCancellation.class);
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final PaidActivitySettlement settlement;
  private final String key;
  public PaidActivityCancellation(JdbcTemplate jdbc,TransactionTemplate tx,PaidActivitySettlement settlement,
      @Value("${STRIPE_SECRET_KEY:}") String key) {
    this.jdbc=jdbc; this.tx=tx; this.settlement=settlement; this.key=key;
  }
  public boolean configured() { return key.startsWith("sk_test_"); }
  private RequestOptions options(String idempotency) {
    if(!configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Stripe test n'est pas configuré.");
    var builder=RequestOptions.builder().setApiKey(key);
    if(idempotency!=null) builder.setIdempotencyKey(idempotency);
    return builder.build();
  }
  private ResponseStatusException retry(String message) { return new ResponseStatusException(HttpStatus.BAD_GATEWAY,message); }

  public void process(long activityId) {
    var attempts=jdbc.queryForList("""
      SELECT id,session_stripe,montant_centimes FROM reservation_payante_activite
      WHERE activite_id=? AND statut='EN_ATTENTE' ORDER BY id
      """,activityId);
    for(var attempt:attempts) {
      long id=((Number)attempt.get("id")).longValue();
      String sessionId=(String)attempt.get("session_stripe");
      if(sessionId==null)
        throw retry("L'activité est fermée, mais une tentative Stripe sans session doit être vérifiée avant de terminer l'annulation.");
      try {
        Session session=Session.retrieve(sessionId,options(null));
        if(!Boolean.FALSE.equals(session.getLivemode()) || !sessionId.equals(session.getId())
            || !("activity-booking-"+id).equals(session.getClientReferenceId())
            || session.getAmountTotal()==null
            || session.getAmountTotal()!=((Number)attempt.get("montant_centimes")).longValue()
            || !"eur".equals(session.getCurrency()))
          throw retry("Une session Stripe incohérente doit être vérifiée avant de terminer l'annulation.");
        if("open".equals(session.getStatus())) session=session.expire(options(null));
        if("expired".equals(session.getStatus()))
          settlement.apply(id,sessionId,session.getClientReferenceId(),session.getAmountTotal(),session.getCurrency(),
            session.getPaymentStatus(),session.getPaymentIntent(),"checkout.session.expired");
        else if("complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus()))
          settlement.apply(id,sessionId,session.getClientReferenceId(),session.getAmountTotal(),session.getCurrency(),
            session.getPaymentStatus(),session.getPaymentIntent(),"checkout.session.completed");
        else throw retry("Le paiement Stripe est encore en cours. L'annulation sera reprise automatiquement.");
      } catch(StripeException ex) { throw retry("Une session Stripe reste à fermer. L'annulation sera reprise automatiquement."); }
    }

    var paid=jdbc.queryForList("""
      SELECT id,paiement_stripe,remboursement_stripe,montant_centimes FROM reservation_payante_activite
      WHERE activite_id=? AND statut IN ('PAYE','REMBOURSEMENT_EN_COURS') ORDER BY id
      """,activityId);
    for(var payment:paid) {
      long id=((Number)payment.get("id")).longValue();
      String intent=(String)payment.get("paiement_stripe");
      if(intent==null || !intent.startsWith("pi_")) throw retry("Un paiement doit être vérifié avant le remboursement.");
      jdbc.update("UPDATE reservation_payante_activite SET statut='REMBOURSEMENT_EN_COURS' WHERE id=? AND statut='PAYE'",id);
      try {
        Refund refund=payment.get("remboursement_stripe")==null
          ? Refund.create(RefundCreateParams.builder().setPaymentIntent(intent)
              .setReverseTransfer(true).setRefundApplicationFee(true).build(),
              options("belconnect-activity-refund-"+id+"-v1"))
          : Refund.retrieve((String)payment.get("remboursement_stripe"),options(null));
        if(refund.getId()==null || !refund.getId().startsWith("re_")
            || refund.getAmount()==null || refund.getAmount()!=((Number)payment.get("montant_centimes")).longValue()
            || !"eur".equals(refund.getCurrency())
            || !intent.equals(refund.getPaymentIntent()))
          throw retry("Une réponse de remboursement Stripe doit être vérifiée.");
        jdbc.update("UPDATE reservation_payante_activite SET remboursement_stripe=?,statut=? WHERE id=?",
          refund.getId(),"succeeded".equals(refund.getStatus())?"REMBOURSE":"REMBOURSEMENT_EN_COURS",id);
        if(!"succeeded".equals(refund.getStatus()))
          throw retry("L'activité est fermée ; un remboursement est toujours en cours ou nécessite un examen.");
      } catch(StripeException ex) { throw retry("Un remboursement Stripe reste à vérifier. L'annulation sera reprise automatiquement."); }
    }

    tx.executeWithoutResult(status->{
      jdbc.queryForList("SELECT id FROM activite WHERE id=? AND annulee=true FOR UPDATE",activityId);
      int unresolved=jdbc.queryForObject("""
        SELECT count(*) FROM reservation_payante_activite WHERE activite_id=?
          AND statut IN ('EN_ATTENTE','PAYE','REMBOURSEMENT_EN_COURS')
        """,Integer.class,activityId);
      if(unresolved>0) throw retry("Des paiements restent à vérifier avant de terminer l'annulation.");
      jdbc.update("""
        INSERT INTO notification_activite(utilisateur_id,inscription_id,activite_id)
        SELECT utilisateur_id,id,activite_id FROM inscription_activite
        WHERE activite_id=? AND statut='CONFIRMEE'
        ON CONFLICT (inscription_id,utilisateur_id,evenement) DO NOTHING
        """,activityId);
      jdbc.update("UPDATE inscription_activite SET statut='ANNULEE',date_annulation=now(),version=version+1 WHERE activite_id=? AND statut='CONFIRMEE'",activityId);
      jdbc.update("UPDATE activite SET places_disponibles=capacite WHERE id=?",activityId);
    });
  }

  @Scheduled(initialDelayString="${belconnect.paid-activity-refunds.initial-delay-ms:90000}",
      fixedDelayString="${belconnect.paid-activity-refunds.delay-ms:300000}")
  public void retryCancelledActivities() {
    if(!configured()) return;
    var ids=jdbc.queryForList("""
      SELECT a.id FROM activite a WHERE a.annulee=true AND a.prix>0 AND
        (EXISTS (SELECT 1 FROM reservation_payante_activite r WHERE r.activite_id=a.id
          AND r.statut IN ('EN_ATTENTE','PAYE','REMBOURSEMENT_EN_COURS'))
         OR EXISTS (SELECT 1 FROM inscription_activite i WHERE i.activite_id=a.id AND i.statut='CONFIRMEE'))
      ORDER BY a.id LIMIT 25
      """,Long.class);
    for(long id:ids) {
      try { process(id); }
      catch(RuntimeException ex) { log.warn("Remboursements de l'activité {} encore incomplets ; nouvel essai programmé",id); }
    }
  }
}
