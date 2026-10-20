package be.belconnect.backend.project;

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
import org.springframework.web.server.ResponseStatusException;

/** Closes pending Checkouts and resumes full refunds for a cancelled project offer. */
@Service
public class PaidProjectCancellation {
  private static final Logger log=LoggerFactory.getLogger(PaidProjectCancellation.class);
  private final JdbcTemplate jdbc;
  private final ProjectPaymentSettlement settlement;
  private final String key;
  public PaidProjectCancellation(JdbcTemplate jdbc,ProjectPaymentSettlement settlement,
      @Value("${STRIPE_SECRET_KEY:}") String key) {
    this.jdbc=jdbc; this.settlement=settlement; this.key=key;
  }
  private RequestOptions options(String idempotency) {
    if(!key.startsWith("sk_test_")) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Stripe test n'est pas configuré.");
    var b=RequestOptions.builder().setApiKey(key);
    if(idempotency!=null) b.setIdempotencyKey(idempotency);
    return b.build();
  }
  private ResponseStatusException retry(String message) { return new ResponseStatusException(HttpStatus.BAD_GATEWAY,message); }

  public void process(long projectId) {
    var attempts=jdbc.queryForList("""
      SELECT id,session_stripe,prix_centimes FROM inscription_payante_projet
      WHERE projet_id=? AND statut='EN_ATTENTE' ORDER BY id
      """,projectId);
    for(var attempt:attempts) {
      long id=((Number)attempt.get("id")).longValue();
      String sessionId=(String)attempt.get("session_stripe");
      if(sessionId==null) throw retry("L'offre est fermée ; une tentative sans session Stripe nécessite une vérification.");
      try {
        Session session=Session.retrieve(sessionId,options(null));
        if(!Boolean.FALSE.equals(session.getLivemode()) || !sessionId.equals(session.getId())
            || !("project-participation-"+id).equals(session.getClientReferenceId())
            || session.getAmountTotal()==null
            || session.getAmountTotal()!=((Number)attempt.get("prix_centimes")).longValue()
            || !"eur".equals(session.getCurrency()))
          throw retry("Une session Stripe incohérente nécessite une vérification.");
        if("open".equals(session.getStatus())) session=session.expire(options(null));
        if("expired".equals(session.getStatus()))
          settlement.paidParticipation(id,sessionId,session.getAmountTotal(),session.getCurrency(),
            session.getPaymentStatus(),session.getPaymentIntent(),"checkout.session.expired");
        else if("complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus()))
          settlement.paidParticipation(id,sessionId,session.getAmountTotal(),session.getCurrency(),
            session.getPaymentStatus(),session.getPaymentIntent(),"checkout.session.completed");
        else throw retry("Le paiement Stripe est encore en cours ; reprise automatique prévue.");
      } catch(StripeException ex) { throw retry("Une session Stripe reste à vérifier ; reprise automatique prévue."); }
    }
    var paid=jdbc.queryForList("""
      SELECT id,paiement_stripe,remboursement_stripe,prix_centimes FROM inscription_payante_projet
      WHERE projet_id=? AND statut IN ('PAYE','REMBOURSEMENT_EN_COURS') ORDER BY id
      """,projectId);
    for(var row:paid) {
      long id=((Number)row.get("id")).longValue();
      String intent=(String)row.get("paiement_stripe");
      if(intent==null || !intent.startsWith("pi_")) throw retry("Un paiement nécessite une vérification avant remboursement.");
      jdbc.update("UPDATE inscription_payante_projet SET statut='REMBOURSEMENT_EN_COURS' WHERE id=? AND statut='PAYE'",id);
      try {
        Refund refund=row.get("remboursement_stripe")==null
          ? Refund.create(RefundCreateParams.builder().setPaymentIntent(intent)
              .setReverseTransfer(true).setRefundApplicationFee(true).build(),
              options("belconnect-project-participation-refund-"+id+"-v1"))
          : Refund.retrieve((String)row.get("remboursement_stripe"),options(null));
        if(refund.getId()==null || !refund.getId().startsWith("re_") || refund.getAmount()==null
            || refund.getAmount()!=((Number)row.get("prix_centimes")).longValue()
            || !"eur".equals(refund.getCurrency()) || !intent.equals(refund.getPaymentIntent()))
          throw retry("Une réponse de remboursement Stripe nécessite une vérification.");
        jdbc.update("UPDATE inscription_payante_projet SET remboursement_stripe=?,statut=? WHERE id=?",
          refund.getId(),"succeeded".equals(refund.getStatus())?"REMBOURSE":"REMBOURSEMENT_EN_COURS",id);
        if(!"succeeded".equals(refund.getStatus())) throw retry("Un remboursement est encore en cours ; reprise automatique prévue.");
      } catch(StripeException ex) { throw retry("Un remboursement reste à vérifier ; reprise automatique prévue."); }
    }
  }

  @Scheduled(initialDelayString="${belconnect.project-refunds.initial-delay-ms:90000}",
      fixedDelayString="${belconnect.project-refunds.delay-ms:300000}")
  public void retryCancelledOffers() {
    if(!key.startsWith("sk_test_")) return;
    var ids=jdbc.queryForList("""
      SELECT DISTINCT o.projet_id FROM offre_participation_projet o
      JOIN inscription_payante_projet i ON i.projet_id=o.projet_id
      WHERE o.active=false AND i.statut IN ('EN_ATTENTE','PAYE','REMBOURSEMENT_EN_COURS')
      ORDER BY o.projet_id LIMIT 25
      """,Long.class);
    for(long id:ids) {
      try { process(id); }
      catch(RuntimeException ex) { log.warn("Remboursements du projet {} encore incomplets ; nouvel essai programmé",id,ex); }
    }
  }
}
