package be.belconnect.backend.workspace;

import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.net.RequestOptions;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace/spaces/{spaceId}/stripe-connect")
public class StripeConnectController {
  private final JdbcTemplate jdbc;
  private final String secretKey;
  private final String publicUrl;

  public StripeConnectController(JdbcTemplate jdbc,
      @Value("${STRIPE_SECRET_KEY:}") String secretKey,
      @Value("${APP_PUBLIC_URL:http://localhost:5173}") String publicUrl) {
    this.jdbc=jdbc;
    this.secretKey=secretKey;
    this.publicUrl=publicUrl.replaceAll("/+$", "");
  }

  public record Status(boolean configured, boolean connected, boolean chargesEnabled, boolean payoutsEnabled) {}
  public record Onboarding(String url) {}

  private ResponseStatusException error(HttpStatus status,String message) {
    return new ResponseStatusException(status,message);
  }

  private String accountId(Authentication auth,long spaceId,boolean lock) {
    var rows=jdbc.queryForList("""
      SELECT e.stripe_account_id FROM espace_organisateur e
      JOIN appartenance_espace a ON a.espace_id=e.id
      JOIN utilisateur u ON u.id=a.utilisateur_id
      WHERE e.id=? AND e.statut='ACTIF' AND a.role='ADMINISTRATEUR'
        AND a.statut='ACTIF' AND u.email=? AND u.statut='ACTIF'
      """+(lock?" FOR UPDATE OF e":""),spaceId,auth.getName());
    if(rows.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Espace organisateur introuvable.");
    return (String)rows.getFirst().get("stripe_account_id");
  }

  private RequestOptions options() {
    if(!secretKey.startsWith("sk_test_"))
      throw error(HttpStatus.SERVICE_UNAVAILABLE,"Stripe n’est pas configuré en mode test sur le serveur.");
    return RequestOptions.builder().setApiKey(secretKey).build();
  }

  @GetMapping
  public ResponseEntity<Status> status(Authentication auth,@PathVariable long spaceId) {
    String id=accountId(auth,spaceId,false);
    if(id==null || !secretKey.startsWith("sk_test_"))
      return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(new Status(secretKey.startsWith("sk_test_"),id!=null,false,false));
    try {
      Account account=Account.retrieve(id,options());
      return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(new Status(true,true,Boolean.TRUE.equals(account.getChargesEnabled()),Boolean.TRUE.equals(account.getPayoutsEnabled())));
    } catch(StripeException ex) {
      throw error(HttpStatus.BAD_GATEWAY,"Le statut Stripe est temporairement indisponible.");
    }
  }

  @PostMapping("/onboarding") @Transactional
  public ResponseEntity<Onboarding> onboarding(Authentication auth,@PathVariable long spaceId) {
    String id=accountId(auth,spaceId,true);
    RequestOptions requestOptions=options();
    try {
      if(id==null) {
        // A stable idempotency key also covers a retry after a database rollback.
        var createOptions=RequestOptions.builder().setApiKey(secretKey)
          .setIdempotencyKey("belconnect-space-"+spaceId+"-connect-v1").build();
        Account account=Account.create(AccountCreateParams.builder().setType(AccountCreateParams.Type.EXPRESS).build(),createOptions);
        id=account.getId();
        jdbc.update("UPDATE espace_organisateur SET stripe_account_id=? WHERE id=?",id,spaceId);
      }
      String returnUrl=publicUrl+"/mon-espace?stripe=return";
      String refreshUrl=publicUrl+"/mon-espace?stripe=refresh&space="+spaceId;
      AccountLink link=AccountLink.create(AccountLinkCreateParams.builder()
        .setAccount(id).setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
        .setReturnUrl(returnUrl).setRefreshUrl(refreshUrl).build(),requestOptions);
      URI target=URI.create(link.getUrl());
      if(!"https".equals(target.getScheme()) || !"connect.stripe.com".equals(target.getHost()))
        throw error(HttpStatus.BAD_GATEWAY,"Le lien Stripe reçu est invalide.");
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Onboarding(link.getUrl()));
    } catch(StripeException ex) {
      throw error(HttpStatus.BAD_GATEWAY,"Impossible de préparer Stripe Connect pour le moment.");
    }
  }
}
