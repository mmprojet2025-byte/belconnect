package be.belconnect.backend.project;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies a signed or API-verified Stripe Checkout state to a project transaction. */
@Service
public class ProjectPaymentSettlement {
  private final JdbcTemplate jdbc;
  public ProjectPaymentSettlement(JdbcTemplate jdbc) { this.jdbc=jdbc; }

  @Transactional
  public void donation(long id,String session,long amount,String currency,String paymentStatus,String paymentIntent,String eventType) {
    if(session==null || !session.startsWith("cs_test_")) return;
    var rows=jdbc.queryForList("SELECT montant_centimes,devise,session_stripe,statut FROM don_projet WHERE id=? FOR UPDATE",id);
    if(rows.isEmpty()) return;
    var row=rows.getFirst();
    if(row.get("session_stripe")!=null && !session.equals(row.get("session_stripe"))) return;
    if(((Number)row.get("montant_centimes")).longValue()!=amount || !currency.equals(row.get("devise"))) return;
    String status=(String)row.get("statut");
    if("PAYE".equals(status) || "REMBOURSE".equals(status)) return;
    if(("checkout.session.completed".equals(eventType) || "checkout.session.async_payment_succeeded".equals(eventType))
        && "paid".equals(paymentStatus) && paymentIntent!=null && paymentIntent.startsWith("pi_")) {
      jdbc.update("UPDATE don_projet SET session_stripe=?,paiement_stripe=?,statut='PAYE',date_paiement=now() WHERE id=?",
        session,paymentIntent,id);
    } else if("EN_ATTENTE".equals(status)
        && ("checkout.session.expired".equals(eventType) || "checkout.session.async_payment_failed".equals(eventType))) {
      jdbc.update("UPDATE don_projet SET session_stripe=?,statut=? WHERE id=?",session,
        "checkout.session.expired".equals(eventType)?"EXPIRE":"ECHOUE",id);
    }
  }

  @Transactional
  public void paidParticipation(long id,String session,long amount,String currency,String paymentStatus,String paymentIntent,String eventType) {
    if(session==null || !session.startsWith("cs_test_") || !"eur".equals(currency)) return;
    var ids=jdbc.queryForList("SELECT projet_id FROM inscription_payante_projet WHERE id=?",Long.class,id);
    if(ids.isEmpty()) return;
    // Match reservation and cancellation lock order: offer first, then attempt.
    var offers=jdbc.queryForList("SELECT active FROM offre_participation_projet WHERE projet_id=? FOR UPDATE",ids.getFirst());
    if(offers.isEmpty()) return;
    var rows=jdbc.queryForList("SELECT prix_centimes,session_stripe,statut FROM inscription_payante_projet WHERE id=? FOR UPDATE",id);
    if(rows.isEmpty()) return;
    var row=rows.getFirst();
    if(row.get("session_stripe")!=null && !session.equals(row.get("session_stripe"))) return;
    if(((Number)row.get("prix_centimes")).longValue()!=amount) return;
    String status=(String)row.get("statut");
    if("PAYE".equals(status) || "REMBOURSEMENT_EN_COURS".equals(status) || "REMBOURSE".equals(status)) return;
    if(("checkout.session.completed".equals(eventType) || "checkout.session.async_payment_succeeded".equals(eventType))
        && "paid".equals(paymentStatus) && paymentIntent!=null && paymentIntent.startsWith("pi_")) {
      boolean refund=!Boolean.TRUE.equals(offers.getFirst().get("active")) || !"EN_ATTENTE".equals(status);
      // A genuinely paid late/closed attempt is never discarded: it enters the refund queue.
      jdbc.update("""
        UPDATE inscription_payante_projet SET session_stripe=?,paiement_stripe=?,statut=?,date_paiement=now()
        WHERE id=?
        """,session,paymentIntent,refund?"REMBOURSEMENT_EN_COURS":"PAYE",id);
    } else if("EN_ATTENTE".equals(status)
        && ("checkout.session.expired".equals(eventType) || "checkout.session.async_payment_failed".equals(eventType))) {
      jdbc.update("UPDATE inscription_payante_projet SET session_stripe=?,statut=? WHERE id=?",session,
        "checkout.session.expired".equals(eventType)?"EXPIRE":"ECHOUE",id);
    }
  }
}
