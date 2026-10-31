package be.belconnect.backend.billing;

import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import java.net.URI;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/my-payment-documents")
public class PersonalPaymentDocumentController {
  private final JdbcTemplate jdbc;
  private final String key;
  public PersonalPaymentDocumentController(JdbcTemplate jdbc,@Value("${STRIPE_SECRET_KEY:}") String key) { this.jdbc=jdbc;this.key=key; }
  public record Document(String url, boolean testMode, String kind) {}
  @GetMapping("/{type}/{id}")
  public ResponseEntity<Document> document(Authentication auth,@PathVariable String type,@PathVariable long id) {
    if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    String source=switch(type) {
      case "activity" -> "reservation_payante_activite";
      case "project" -> "inscription_payante_projet";
      case "donation" -> "don_projet";
      default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    };
    String owner=switch(type) {case "activity" -> "utilisateur_id"; case "project" -> "participant_id"; default -> "donateur_id";};
    // Ownership is checked locally before making any Stripe request; IDs are not credentials.
    var rows=jdbc.queryForList("SELECT p.paiement_stripe FROM "+source+" p JOIN utilisateur u ON u.id=p."+owner+
      " WHERE p.id=? AND u.email=? AND u.statut='ACTIF' AND p.statut IN ('PAYE','REMBOURSE','REMBOURSEMENT_EN_COURS')",id,auth.getName());
    if(rows.isEmpty() || rows.getFirst().get("paiement_stripe")==null)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Aucun reçu disponible pour ce paiement.");
    if(!key.startsWith("sk_test_")) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Les reçus ne sont pas disponibles.");
    try {
      var intent=PaymentIntent.retrieve((String)rows.getFirst().get("paiement_stripe"), Map.of("expand",java.util.List.of("latest_charge")),RequestOptions.builder().setApiKey(key).build());
      var charge=intent.getLatestChargeObject();
      String url=charge==null?null:charge.getReceiptUrl();
      if(!safeReceipt(url)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Stripe ne fournit pas encore de reçu pour ce paiement.");
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Document(url,!Boolean.TRUE.equals(intent.getLivemode()),"receipt"));
    } catch(com.stripe.exception.StripeException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Le reçu Stripe est momentanément indisponible. Réessayez.");
    }
  }
  static boolean safeReceipt(String url) {
    if(url==null)return false;
    try {var uri=URI.create(url);return "https".equals(uri.getScheme())&&"pay.stripe.com".equals(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1;}catch(IllegalArgumentException ex){return false;}
  }
}
