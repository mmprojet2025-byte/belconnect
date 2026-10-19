package be.belconnect.backend;

import be.belconnect.backend.booking.PaidActivityReconciliation;
import be.belconnect.backend.booking.PaidActivitySettlement;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PaidActivityReconciliationTests {
  @Test void expiredSessionReleasesHoldThroughVerifiedSettlement() throws Exception {
    JdbcTemplate jdbc=mock(JdbcTemplate.class);
    PaidActivitySettlement settlement=mock(PaidActivitySettlement.class);
    when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of("id",42L,"session_stripe","cs_test_42")));
    Session session=mock(Session.class);
    when(session.getLivemode()).thenReturn(false);
    when(session.getId()).thenReturn("cs_test_42");
    when(session.getClientReferenceId()).thenReturn("activity-booking-42");
    when(session.getStatus()).thenReturn("expired");
    when(session.getAmountTotal()).thenReturn(2500L);
    when(session.getCurrency()).thenReturn("eur");
    try(var stripe=mockStatic(Session.class)) {
      stripe.when(()->Session.retrieve(eq("cs_test_42"),any(RequestOptions.class))).thenReturn(session);
      new PaidActivityReconciliation(jdbc,settlement,"sk_test_local_only").reconcile();
    }
    verify(settlement).apply(42L,"cs_test_42","activity-booking-42",2500L,"eur",null,null,"checkout.session.expired");
  }

  @Test void unexpectedStripeReferenceNeverChangesAReservation() throws Exception {
    JdbcTemplate jdbc=mock(JdbcTemplate.class);
    PaidActivitySettlement settlement=mock(PaidActivitySettlement.class);
    when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of("id",42L,"session_stripe","cs_test_42")));
    Session session=mock(Session.class);
    when(session.getLivemode()).thenReturn(false);
    when(session.getId()).thenReturn("cs_test_42");
    when(session.getClientReferenceId()).thenReturn("activity-booking-999");
    try(var stripe=mockStatic(Session.class)) {
      stripe.when(()->Session.retrieve(eq("cs_test_42"),any(RequestOptions.class))).thenReturn(session);
      new PaidActivityReconciliation(jdbc,settlement,"sk_test_local_only").reconcile();
    }
    verifyNoInteractions(settlement);
  }

  @Test void paidSessionCanConfirmAfterMissedWebhook() throws Exception {
    JdbcTemplate jdbc=mock(JdbcTemplate.class);
    PaidActivitySettlement settlement=mock(PaidActivitySettlement.class);
    when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of("id",43L,"session_stripe","cs_test_43")));
    Session session=mock(Session.class);
    when(session.getLivemode()).thenReturn(false);
    when(session.getId()).thenReturn("cs_test_43");
    when(session.getClientReferenceId()).thenReturn("activity-booking-43");
    when(session.getStatus()).thenReturn("complete");
    when(session.getPaymentStatus()).thenReturn("paid");
    when(session.getAmountTotal()).thenReturn(1200L);
    when(session.getCurrency()).thenReturn("eur");
    when(session.getPaymentIntent()).thenReturn("pi_test_43");
    try(var stripe=mockStatic(Session.class)) {
      stripe.when(()->Session.retrieve(eq("cs_test_43"),any(RequestOptions.class))).thenReturn(session);
      new PaidActivityReconciliation(jdbc,settlement,"sk_test_local_only").reconcile();
    }
    verify(settlement).apply(43L,"cs_test_43","activity-booking-43",1200L,"eur","paid","pi_test_43","checkout.session.completed");
  }

  @Test void missingSessionIdDoesNotReleaseAPlace() {
    JdbcTemplate jdbc=mock(JdbcTemplate.class);
    PaidActivitySettlement settlement=mock(PaidActivitySettlement.class);
    when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of("id",44L)));
    new PaidActivityReconciliation(jdbc,settlement,"sk_test_local_only").reconcile();
    verifyNoInteractions(settlement);
  }
}
