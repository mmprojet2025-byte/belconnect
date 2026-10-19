package be.belconnect.backend.booking;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies a verified Stripe Checkout state, from either a signed webhook or Stripe's API. */
@Service
public class PaidActivitySettlement {
  private final JdbcTemplate jdbc;
  public PaidActivitySettlement(JdbcTemplate jdbc) { this.jdbc=jdbc; }

  @Transactional
  public void apply(long id,String session,String reference,long amount,String currency,
      String paymentStatus,String paymentIntent,String eventType) {
    if(!reference.equals("activity-booking-"+id) || session==null || !session.startsWith("cs_test_")) return;
    var ids=jdbc.queryForList("SELECT activite_id FROM reservation_payante_activite WHERE id=?",Long.class,id);
    if(ids.isEmpty()) return;
    // Match reservation creation's lock order: activity, then payment attempt.
    jdbc.queryForList("SELECT id FROM activite WHERE id=? FOR UPDATE",ids.getFirst());
    var rows=jdbc.queryForList("""
      SELECT activite_id,utilisateur_id,quantite,prenom,nom,email,telephone,montant_centimes,session_stripe,statut
      FROM reservation_payante_activite WHERE id=? FOR UPDATE
      """,id);
    if(rows.isEmpty()) return;
    var booking=rows.getFirst();
    if(booking.get("session_stripe")!=null && !session.equals(booking.get("session_stripe"))) return;
    if(((Number)booking.get("montant_centimes")).longValue()!=amount || !"eur".equals(currency)) return;
    if(!"EN_ATTENTE".equals(booking.get("statut"))) return;
    if(("checkout.session.completed".equals(eventType) || "checkout.session.async_payment_succeeded".equals(eventType))
        && "paid".equals(paymentStatus) && paymentIntent!=null && paymentIntent.startsWith("pi_")) {
      long activityId=((Number)booking.get("activite_id")).longValue();
      long registration=jdbc.queryForObject("""
        INSERT INTO inscription_activite(utilisateur_id,activite_id,quantite,prenom,nom,email,telephone)
        VALUES (?,?,?,?,?,?,?) RETURNING id
        """,Long.class,booking.get("utilisateur_id"),activityId,booking.get("quantite"),booking.get("prenom"),
        booking.get("nom"),booking.get("email"),booking.get("telephone"));
      jdbc.update("UPDATE activite SET places_disponibles=places_disponibles-? WHERE id=?",booking.get("quantite"),activityId);
      jdbc.update("""
        UPDATE reservation_payante_activite SET session_stripe=?,paiement_stripe=?,inscription_id=?,statut='PAYE',date_paiement=now()
        WHERE id=? AND statut='EN_ATTENTE'
        """,session,paymentIntent,registration,id);
    } else if("checkout.session.expired".equals(eventType) || "checkout.session.async_payment_failed".equals(eventType)) {
      jdbc.update("UPDATE reservation_payante_activite SET session_stripe=?,statut=? WHERE id=? AND statut='EN_ATTENTE'",
        session,"checkout.session.expired".equals(eventType)?"EXPIRE":"ECHOUE",id);
    }
  }
}
