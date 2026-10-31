package be.belconnect.backend.booking;

import be.belconnect.backend.activity.ActivityAccess;
import be.belconnect.backend.billing.SpaceCommission;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/paid-activity-bookings")
public class PaidActivityBookingController {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final ActivityAccess access;
  private final SpaceCommission commissions;
  private final String key, webhook, publicUrl;

  public PaidActivityBookingController(JdbcTemplate jdbc, TransactionTemplate tx, ActivityAccess access,
      SpaceCommission commissions, @Value("${STRIPE_SECRET_KEY:}") String key,
      @Value("${STRIPE_WEBHOOK_SECRET:}") String webhook,
      @Value("${APP_PUBLIC_URL:http://localhost:5173}") String publicUrl) {
    this.jdbc=jdbc; this.tx=tx; this.access=access; this.commissions=commissions;
    this.key=key; this.webhook=webhook; this.publicUrl=publicUrl.replaceAll("/+$", "");
  }

  public record Request(@NotNull UUID requestId, @NotBlank @Size(max=100) String activityId,
      @Min(1) @Max(4) int quantity,
      @NotBlank @Size(max=80) String firstName, @NotBlank @Size(max=80) String lastName,
      @NotBlank @Email @Size(max=254) String email, @Size(max=30) String phone,
      @AssertTrue boolean acknowledged) {}
  public record Checkout(long id, String url, String status) {}
  public record Status(long id, String activityId, String title, OffsetDateTime startsAt, String location,
      String image, int quantity, long amountCents, String status, Long registrationId, OffsetDateTime createdAt) {}
  private record Pending(long id, String slug, String title, int quantity, long unitCents,
      long feeCents, String account, String session, String status) {}

  private ResponseStatusException fail(HttpStatus code,String message) { return new ResponseStatusException(code,message); }
  private long user(Authentication auth) {
    return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName())
      .stream().findFirst().orElseThrow(()->fail(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
  }
  private RequestOptions options(String idempotency) {
    if(!key.startsWith("sk_test_") || !webhook.startsWith("whsec_"))
      throw fail(HttpStatus.SERVICE_UNAVAILABLE,"Le paiement des activités n'est pas encore disponible.");
    var b=RequestOptions.builder().setApiKey(key);
    if(idempotency!=null) b.setIdempotencyKey(idempotency);
    return b.build();
  }
  private Pending reserve(long uid,Request body) {
    var ids=jdbc.queryForList("SELECT id FROM activite WHERE slug=?",Long.class,body.activityId());
    if(ids.isEmpty()) throw fail(HttpStatus.NOT_FOUND,"Activité introuvable.");
    long activityId=ids.getFirst();
    access.lockAndCheck(activityId,uid);
    Map<String,Object> a=jdbc.queryForMap("""
      SELECT a.slug,a.titre,a.prix,a.publiee,a.demonstration,a.annulee,a.places_disponibles,
             a.espace_id,a.debut,a.cloture_inscriptions,e.stripe_account_id
      FROM activite a JOIN espace_organisateur e ON e.id=a.espace_id WHERE a.id=? FOR UPDATE OF a
      """,activityId);
    if(!Boolean.TRUE.equals(a.get("publiee")) || Boolean.TRUE.equals(a.get("annulee")) || Boolean.TRUE.equals(a.get("demonstration")))
      throw fail(HttpStatus.NOT_FOUND,"Activité indisponible.");
    BigDecimal price=(BigDecimal)a.get("prix");
    if(price.signum()<=0) throw fail(HttpStatus.CONFLICT,"Cette activité est gratuite.");
    if(price.scale()>2) throw fail(HttpStatus.CONFLICT,"Tarif invalide.");
    if(jdbc.queryForObject("SELECT COALESCE(cloture_inscriptions,debut) <= clock_timestamp() FROM activite WHERE id=?",Boolean.class,activityId))
      throw fail(HttpStatus.CONFLICT,"Les inscriptions à cette activité sont closes.");
    var old=jdbc.queryForList("""
      SELECT r.id,r.quantite,r.montant_centimes,r.commission_centimes,r.compte_stripe,r.session_stripe,r.statut
      FROM reservation_payante_activite r WHERE r.utilisateur_id=? AND r.demande=?
      """,uid,body.requestId());
    if(!old.isEmpty()) {
      var r=old.getFirst();
      if(!jdbc.queryForObject("SELECT activite_id=? FROM reservation_payante_activite WHERE id=?",Boolean.class,activityId,r.get("id"))
          || ((Number)r.get("quantite")).intValue()!=body.quantity())
        throw fail(HttpStatus.CONFLICT,"Cette demande a déjà servi.");
      return new Pending(((Number)r.get("id")).longValue(),(String)a.get("slug"),(String)a.get("titre"),body.quantity(),
        price.movePointRight(2).longValueExact(),((Number)r.get("commission_centimes")).longValue(),
        (String)r.get("compte_stripe"),(String)r.get("session_stripe"),(String)r.get("statut"));
    }
    if(jdbc.queryForObject("SELECT count(*) FROM inscription_activite WHERE utilisateur_id=? AND activite_id=? AND statut='CONFIRMEE'",Integer.class,uid,activityId)>0)
      throw fail(HttpStatus.CONFLICT,"Vous êtes déjà inscrit à cette activité.");
    var prior=jdbc.queryForList("SELECT statut FROM reservation_payante_activite WHERE utilisateur_id=? AND activite_id=? AND statut IN ('EN_ATTENTE','PAYE','REMBOURSEMENT_EN_COURS') LIMIT 1",uid,activityId);
    if(!prior.isEmpty()) throw fail(HttpStatus.CONFLICT,"PAYE".equals(prior.getFirst().get("statut"))
      ? "Vous êtes déjà inscrit à cette activité." : "Un paiement est déjà en cours pour cette activité.");
    int held=jdbc.queryForObject("SELECT COALESCE(sum(quantite),0) FROM reservation_payante_activite WHERE activite_id=? AND statut='EN_ATTENTE'",Integer.class,activityId);
    if(((Number)a.get("places_disponibles")).intValue()-held<body.quantity())
      throw fail(HttpStatus.CONFLICT,"Il ne reste pas assez de places.");
    String account=(String)a.get("stripe_account_id");
    if(account==null || !account.startsWith("acct_")) throw fail(HttpStatus.CONFLICT,"Le paiement de l'organisateur n'est pas encore prêt.");
    long unit=price.movePointRight(2).longValueExact();
    long total=Math.multiplyExact(unit,body.quantity());
    if(unit<50 || total>99999999)
      throw fail(HttpStatus.CONFLICT,"Le montant de ce paiement dépasse les limites de Stripe.");
    long fee=commissions.cents(((Number)a.get("espace_id")).longValue(),total);
    long id=jdbc.queryForObject("""
      INSERT INTO reservation_payante_activite(activite_id,utilisateur_id,demande,quantite,prenom,nom,email,telephone,montant_centimes,commission_centimes,compte_stripe)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id
      """,Long.class,activityId,uid,body.requestId(),body.quantity(),body.firstName().strip(),body.lastName().strip(),
      body.email().strip(),body.phone()==null?"":body.phone().strip(),total,fee,account);
    return new Pending(id,(String)a.get("slug"),(String)a.get("titre"),body.quantity(),unit,fee,account,null,"EN_ATTENTE");
  }

  @PostMapping
  public Checkout checkout(Authentication auth,@Valid @RequestBody Request body) {
    long uid=user(auth);
    options(null);
    Pending p=tx.execute(s->reserve(uid,body));
    if(!"EN_ATTENTE".equals(p.status())) throw fail(HttpStatus.CONFLICT,"Cette réservation est déjà traitée.");
    try {
      Account account=Account.retrieve(p.account(),options(null));
      if(!Boolean.TRUE.equals(account.getChargesEnabled()) || !Boolean.TRUE.equals(account.getPayoutsEnabled())) {
        if(p.session()==null) jdbc.update("UPDATE reservation_payante_activite SET statut='ECHOUE' WHERE id=? AND statut='EN_ATTENTE' AND session_stripe IS NULL",p.id());
        throw fail(HttpStatus.CONFLICT,"Le compte de l'organisateur n'est pas prêt.");
      }
      Session session;
      if(p.session()!=null) session=Session.retrieve(p.session(),options(null));
      else {
        var params=SessionCreateParams.builder().setMode(SessionCreateParams.Mode.PAYMENT)
          .addAllowedPaymentMethodType(SessionCreateParams.AllowedPaymentMethodType.CARD)
          .setClientReferenceId("activity-booking-"+p.id())
          .setExpiresAt((System.currentTimeMillis()/1000)+1800)
          .setSuccessUrl(publicUrl+"/mon-espace?paiementActivite="+p.id())
          .setCancelUrl(publicUrl+"/activites/"+p.slug()+"/inscription?paiement=annule")
          .addLineItem(SessionCreateParams.LineItem.builder().setQuantity((long)p.quantity())
            .setPriceData(SessionCreateParams.LineItem.PriceData.builder().setCurrency("eur").setUnitAmount(p.unitCents())
              .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder().setName(p.title()).build()).build()).build())
          .setPaymentIntentData(SessionCreateParams.PaymentIntentData.builder().setApplicationFeeAmount(p.feeCents())
            .setTransferData(SessionCreateParams.PaymentIntentData.TransferData.builder().setDestination(p.account()).build()).build()).build();
        session=Session.create(params,options("belconnect-paid-activity-"+p.id()+"-v1"));
        jdbc.update("UPDATE reservation_payante_activite SET session_stripe=? WHERE id=? AND session_stripe IS NULL",session.getId(),p.id());
      }
      if("expired".equals(session.getStatus()))
        jdbc.update("UPDATE reservation_payante_activite SET statut='EXPIRE' WHERE id=? AND statut='EN_ATTENTE'",p.id());
      if(!"open".equals(session.getStatus()) || session.getUrl()==null || !session.getUrl().startsWith("https://checkout.stripe.com/"))
        throw fail(HttpStatus.CONFLICT,"Cette session a expiré. Recommencez.");
      return new Checkout(p.id(),session.getUrl(),"EN_ATTENTE");
    } catch(StripeException ex) { throw fail(HttpStatus.BAD_GATEWAY,"Stripe est temporairement indisponible."); }
  }

  private final org.springframework.jdbc.core.RowMapper<Status> statusMapper=(r,n)->new Status(
      r.getLong("id"),r.getString("slug"),r.getString("titre"),r.getObject("debut",OffsetDateTime.class),
      r.getString("lieu"),r.getString("image"),r.getInt("quantite"),r.getLong("montant_centimes"),
      r.getString("statut"),r.getObject("inscription_id",Long.class),r.getObject("date_creation",OffsetDateTime.class));

  @GetMapping
  public java.util.List<Status> mine(Authentication auth) {
    return jdbc.query("""
      SELECT r.id,r.quantite,r.montant_centimes,r.statut,r.inscription_id,r.date_creation,
             a.slug,a.titre,a.debut,a.lieu,a.image
      FROM reservation_payante_activite r JOIN activite a ON a.id=r.activite_id
      WHERE r.utilisateur_id=? ORDER BY r.date_creation DESC,r.id DESC LIMIT 100
      """,statusMapper,user(auth));
  }

  @GetMapping("/{id}")
  public Status status(Authentication auth,@PathVariable long id) {
    return jdbc.query("""
      SELECT r.id,r.quantite,r.montant_centimes,r.statut,r.inscription_id,r.date_creation,
             a.slug,a.titre,a.debut,a.lieu,a.image
      FROM reservation_payante_activite r JOIN activite a ON a.id=r.activite_id
      WHERE r.id=? AND r.utilisateur_id=?
      """,statusMapper,id,user(auth)).stream().findFirst()
      .orElseThrow(()->fail(HttpStatus.NOT_FOUND,"Réservation introuvable."));
  }
}
