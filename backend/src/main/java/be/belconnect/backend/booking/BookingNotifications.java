package be.belconnect.backend.booking;
import org.springframework.jdbc.core.JdbcTemplate;
/** Called inside the transaction that confirms the registration. */
final class BookingNotifications {
 private BookingNotifications() {}
 static void confirmed(JdbcTemplate jdbc,long registration,boolean paid) {
  jdbc.update("""
   INSERT INTO notification_activite(utilisateur_id,inscription_id,activite_id,evenement)
   SELECT utilisateur_id,id,activite_id,? FROM inscription_activite WHERE id=?
   ON CONFLICT (inscription_id,utilisateur_id,evenement) DO NOTHING
   """,paid?"PAIEMENT_CONFIRME":"INSCRIPTION_CONFIRMEE",registration);
  jdbc.update("""
   INSERT INTO notification_activite(utilisateur_id,inscription_id,activite_id,evenement)
   SELECT ae.utilisateur_id,i.id,i.activite_id,? FROM inscription_activite i
   JOIN activite a ON a.id=i.activite_id
   JOIN appartenance_espace ae ON ae.espace_id=a.espace_id
   JOIN utilisateur u ON u.id=ae.utilisateur_id
   WHERE i.id=? AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF' AND u.statut='ACTIF' AND ae.utilisateur_id<>i.utilisateur_id
   ON CONFLICT (inscription_id,utilisateur_id,evenement) DO NOTHING
   """,paid?"INSCRIPTION_PAYANTE_RECUE":"INSCRIPTION_RECUE",registration);
 }
}
