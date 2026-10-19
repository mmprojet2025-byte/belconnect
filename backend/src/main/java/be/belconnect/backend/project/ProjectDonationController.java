package be.belconnect.backend.project;

import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import be.belconnect.backend.billing.SpaceCommission;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/project-donations")
public class ProjectDonationController {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate transactions;
  private final SpaceCommission commissions;
  private final String secretKey;
  private final String webhookSecret;
  private final String publicUrl;
  public ProjectDonationController(JdbcTemplate jdbc,TransactionTemplate transactions,SpaceCommission commissions,
      @Value("${STRIPE_SECRET_KEY:}") String secretKey,
      @Value("${STRIPE_WEBHOOK_SECRET:}") String webhookSecret,
      @Value("${APP_PUBLIC_URL:http://localhost:5173}") String publicUrl) {
    this.jdbc=jdbc; this.transactions=transactions; this.commissions=commissions; this.secretKey=secretKey; this.webhookSecret=webhookSecret;
    this.publicUrl=publicUrl.replaceAll("/+$", "");
  }
  public record Request(@NotNull UUID requestId,@NotNull Long projectId,
      @NotNull @Min(100) @Max(10000000) Long amountCents) {}
  public record Donation(long id,long projectId,String projectTitle,long amountCents,String status,OffsetDateTime createdAt) {}
  public record Checkout(long id,String url,String status) {}
  public record Availability(boolean available,int commissionPercent) {}
  private record Pending(long id,long projectId,String title,long amountCents,long feeCents,String accountId,String sessionId,String status) {}
  private ResponseStatusException error(HttpStatus code,String message) { return new ResponseStatusException(code,message); }
  private long user(Authentication auth) {
    return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst()
      .orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
  }
  private RequestOptions options(String idempotencyKey) {
    if(!secretKey.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_"))
      throw error(HttpStatus.SERVICE_UNAVAILABLE,"Les dons ne sont pas encore disponibles.");
    var builder=RequestOptions.builder().setApiKey(secretKey);
    if(idempotencyKey!=null) builder.setIdempotencyKey(idempotencyKey);
    return builder.build();
  }
  private Pending pending(long donor,Request body) {
    var projects=jdbc.queryForList("""
      SELECT p.id,p.titre,p.espace_id,e.stripe_account_id
      FROM projet p JOIN espace_organisateur e ON e.id=p.espace_id
      LEFT JOIN groupe g ON g.id=p.groupe_id
      WHERE p.id=? AND p.publie AND p.statut='APPROUVE' AND e.statut='ACTIF'
        AND (p.groupe_id IS NULL OR g.statut='ACTIF')
        AND (p.visibilite='PUBLIQUE' OR (p.visibilite='GROUPE' AND EXISTS (
          SELECT 1 FROM appartenance_groupe ag JOIN appartenance_espace ae
            ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
          WHERE ag.groupe_id=p.groupe_id AND ag.espace_id=p.espace_id
            AND ag.utilisateur_id=? AND ag.statut='ACTIF' AND ae.statut='ACTIF')))
      """,body.projectId(),donor);
    if(projects.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Projet indisponible.");
    var project=projects.getFirst();
    String account=(String)project.get("stripe_account_id");
    if(account==null) throw error(HttpStatus.CONFLICT,"L'organisateur prépare encore les dons pour ce projet.");
    long fee=commissions.cents(((Number)project.get("espace_id")).longValue(),body.amountCents());
    jdbc.update("""
      INSERT INTO don_projet(projet_id,donateur_id,demande,montant_centimes,commission_centimes,compte_stripe)
      VALUES (?,?,?,?,?,?) ON CONFLICT (donateur_id,demande) DO NOTHING
      """,body.projectId(),donor,body.requestId(),body.amountCents(),fee,account);
    var row=jdbc.queryForMap("""
      SELECT id,projet_id,montant_centimes,commission_centimes,compte_stripe,session_stripe,statut
      FROM don_projet WHERE donateur_id=? AND demande=? FOR UPDATE
      """,donor,body.requestId());
    if(((Number)row.get("projet_id")).longValue()!=body.projectId()
        || ((Number)row.get("montant_centimes")).longValue()!=body.amountCents())
      throw error(HttpStatus.CONFLICT,"Cette demande a déjà servi pour un autre don.");
    if(!account.equals(row.get("compte_stripe")))
      throw error(HttpStatus.CONFLICT,"Le compte de l'organisateur a changé. Recommencez le don.");
    return new Pending(((Number)row.get("id")).longValue(),body.projectId(),(String)project.get("titre"),
      body.amountCents(),((Number)row.get("commission_centimes")).longValue(),account,(String)row.get("session_stripe"),(String)row.get("statut"));
  }
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  public Checkout create(Authentication auth,@Valid @RequestBody Request body) {
    long donor=user(auth);
    RequestOptions requestOptions=options(null);
    Pending intent=transactions.execute(tx->pending(donor,body));
    if(!"EN_ATTENTE".equals(intent.status())) throw error(HttpStatus.CONFLICT,"Ce don a déjà été traité.");
    try {
      Account account=Account.retrieve(intent.accountId(),requestOptions);
      if(!Boolean.TRUE.equals(account.getChargesEnabled()) || !Boolean.TRUE.equals(account.getPayoutsEnabled()))
        throw error(HttpStatus.CONFLICT,"Le compte de paiement de l'organisateur n'est pas encore prêt.");
      Session session;
      if(intent.sessionId()!=null) session=Session.retrieve(intent.sessionId(),requestOptions);
      else {
        var params=SessionCreateParams.builder()
          .setMode(SessionCreateParams.Mode.PAYMENT)
          .setClientReferenceId(Long.toString(intent.id()))
          .setSuccessUrl(publicUrl+"/projets/"+intent.projectId()+"?donation="+intent.id())
          .setCancelUrl(publicUrl+"/projets/"+intent.projectId()+"?donation=annule")
          .addLineItem(SessionCreateParams.LineItem.builder().setQuantity(1L)
            .setPriceData(SessionCreateParams.LineItem.PriceData.builder().setCurrency("eur")
              .setUnitAmount(intent.amountCents())
              .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                .setName("Soutien au projet : "+intent.title()).build()).build()).build())
          .setPaymentIntentData(SessionCreateParams.PaymentIntentData.builder()
            .setApplicationFeeAmount(intent.feeCents())
            .setTransferData(SessionCreateParams.PaymentIntentData.TransferData.builder()
              .setDestination(intent.accountId()).build()).build())
          .build();
        session=Session.create(params,options("belconnect-project-donation-"+intent.id()+"-v1"));
        jdbc.update("UPDATE don_projet SET session_stripe=? WHERE id=? AND session_stripe IS NULL",session.getId(),intent.id());
      }
      if(session.getUrl()==null || !session.getUrl().startsWith("https://checkout.stripe.com/"))
        throw error(HttpStatus.CONFLICT,"Cette session de don a expiré. Recommencez le don.");
      return new Checkout(intent.id(),session.getUrl(),"EN_ATTENTE");
    } catch(StripeException ex) {
      throw error(HttpStatus.BAD_GATEWAY,"Stripe est temporairement indisponible. Réessayez.");
    }
  }
  @GetMapping public ResponseEntity<List<Donation>> list(Authentication auth) {
    long donor=user(auth);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(jdbc.query("""
      SELECT d.id,d.projet_id,p.titre,d.montant_centimes,d.statut,d.date_creation
      FROM don_projet d JOIN projet p ON p.id=d.projet_id
      WHERE d.donateur_id=? ORDER BY d.date_creation DESC,d.id DESC LIMIT 50
      """,(r,n)->new Donation(r.getLong("id"),r.getLong("projet_id"),r.getString("titre"),r.getLong("montant_centimes"),r.getString("statut"),r.getObject("date_creation",OffsetDateTime.class)),donor));
  }
  @GetMapping("/availability") public ResponseEntity<Availability> availability(Authentication auth,@RequestParam long projectId) {
    long donor=user(auth);
    var ids=jdbc.query("""
      SELECT e.stripe_account_id,p.espace_id FROM projet p
      JOIN espace_organisateur e ON e.id=p.espace_id LEFT JOIN groupe g ON g.id=p.groupe_id
      WHERE p.id=? AND p.publie AND p.statut='APPROUVE' AND e.statut='ACTIF'
        AND (p.groupe_id IS NULL OR g.statut='ACTIF')
        AND (p.visibilite='PUBLIQUE' OR (p.visibilite='GROUPE' AND EXISTS (
          SELECT 1 FROM appartenance_groupe ag JOIN appartenance_espace ae
            ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
          WHERE ag.groupe_id=p.groupe_id AND ag.espace_id=p.espace_id
            AND ag.utilisateur_id=? AND ag.statut='ACTIF' AND ae.statut='ACTIF')))
      """,(r,n)->new Object[]{r.getString("stripe_account_id"),r.getLong("espace_id")},projectId,donor);
    if(ids.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Projet indisponible.");
    String accountId=(String)ids.getFirst()[0];
    int percent=commissions.percent((Long)ids.getFirst()[1]);
    if(accountId==null || !secretKey.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_"))
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Availability(false,percent));
    try {
      Account account=Account.retrieve(accountId,options(null));
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Availability(
        Boolean.TRUE.equals(account.getChargesEnabled()) && Boolean.TRUE.equals(account.getPayoutsEnabled()),percent));
    } catch(StripeException ex) { throw error(HttpStatus.BAD_GATEWAY,"Stripe est temporairement indisponible."); }
  }
  @GetMapping("/{id}") public ResponseEntity<Donation> detail(Authentication auth,@PathVariable long id) {
    long donor=user(auth);
    var donations=jdbc.query("""
      SELECT d.id,d.projet_id,p.titre,d.montant_centimes,d.statut,d.date_creation
      FROM don_projet d JOIN projet p ON p.id=d.projet_id WHERE d.id=? AND d.donateur_id=?
      """,(r,n)->new Donation(r.getLong("id"),r.getLong("projet_id"),r.getString("titre"),r.getLong("montant_centimes"),r.getString("statut"),r.getObject("date_creation",OffsetDateTime.class)),id,donor);
    if(donations.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Don introuvable.");
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(donations.getFirst());
  }
}
