package be.belconnect.backend.billing;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class PersonalPaymentDocumentTests {
 @Test void rejectsUnownedPaymentBeforeStripe() {
  var jdbc=mock(JdbcTemplate.class);
  var controller=new PersonalPaymentDocumentController(jdbc,"sk_test_unused");
  var auth=new UsernamePasswordAuthenticationToken("member@example.com","unused");
  for(String type:java.util.List.of("activity","project","donation")) {
   var error=assertThrows(ResponseStatusException.class,()->controller.document(auth,type,987));
   assertEquals(404,error.getStatusCode().value());
  }
  verify(jdbc).queryForList(contains("u.id=p.utilisateur_id"),eq(987L),eq("member@example.com"));
  verify(jdbc).queryForList(contains("u.id=p.participant_id"),eq(987L),eq("member@example.com"));
  verify(jdbc).queryForList(contains("u.id=p.donateur_id"),eq(987L),eq("member@example.com"));
 }
 @Test void onlyOfficialReceiptLinks() {
  assertTrue(PersonalPaymentDocumentController.safeReceipt("https://pay.stripe.com/receipts/test"));
  for(String url:java.util.List.of("http://pay.stripe.com/a","https://pay.stripe.com.evil.test/a","https://evil.test/a","https://user@pay.stripe.com/a"))assertFalse(PersonalPaymentDocumentController.safeReceipt(url));
 }
}
