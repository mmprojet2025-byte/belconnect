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
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/project-paid-participations")
public class PaidProjectParticipationController {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final SpaceCommission commissions;
  private final PaidProjectCancellation cancellation;
  private final String key, webhook, publicUrl;
  public PaidProjectParticipationController(JdbcTemplate jdbc, TransactionTemplate tx,SpaceCommission commissions,
      PaidProjectCancellation cancellation,
      @Value("${STRIPE_SECRET_KEY:}") String key,
      @Value("${STRIPE_WEBHOOK_SECRET:}") String webhook,
      @Value("${APP_PUBLIC_URL:http://localhost:5173}") String publicUrl) {
    this.jdbc=jdbc; this.tx=tx; this.commissions=commissions; this.cancellation=cancellation;
    this.key=key; this.webhook=webhook; this.publicUrl=publicUrl.replaceAll("/+$", "");
  }
  public record Offer(long projectId,String description,long priceCents,int capacity,int placesLeft,boolean active,boolean paymentReady,int commissionPercent,
      OffsetDateTime startsAt,String venue) {}
  public record OfferInput(@NotBlank @Size(min=10,max=500) String description,@Min(0) @Max(10000000) long priceCents,
      @Min(1) @Max(100000) int capacity,@NotNull LocalDateTime startsAt,@NotBlank @Size(min=5,max=240) String venue) {}
  public record Request(@NotNull UUID requestId,@NotNull Long projectId) {}
  public record Checkout(long id,String url,String status) {}
  public record Enrollment(long id,long projectId,String projectTitle,long priceCents,String status,OffsetDateTime createdAt) {}
  public record FreeEnrollment(long id,long projectId,String projectTitle,String status,OffsetDateTime createdAt) {}
  private record Pending(long id,long projectId,String title,long price,long fee,String account,String session,String status) {}
  private ResponseStatusException fail(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
  private long user(Authentication auth) {
    return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst()
      .orElseThrow(()->fail(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
  }
  private RequestOptions options(String idempotency) {
    if(!key.startsWith("sk_test_") || !webhook.startsWith("whsec_")) throw fail(HttpStatus.SERVICE_UNAVAILABLE,"Le paiement des projets n'est pas encore disponible.");
    var b=RequestOptions.builder().setApiKey(key);
    if(idempotency!=null) b.setIdempotencyKey(idempotency);
    return b.build();
  }
  private void admin(long uid,long projectId,boolean settlement) {
    if(jdbc.queryForList("""
      SELECT p.id FROM projet p JOIN appartenance_espace ae ON ae.espace_id=p.espace_id
      JOIN espace_organisateur e ON e.id=p.espace_id
      WHERE p.id=? AND ae.utilisateur_id=? AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF'
        AND (e.statut='ACTIF' OR (? AND e.statut='SUSPENDU'))
      """,projectId,uid,settlement).isEmpty()) throw fail(HttpStatus.NOT_FOUND,"Projet introuvable dans vos espaces administrés.");
  }
  private void admin(long uid,long projectId) { admin(uid,projectId,false); }
  private Offer offer(long id, boolean onlyPublished, Long uid) {
    var rows=jdbc.queryForList("""
      SELECT p.id,p.publie,p.masque_moderation,p.statut,p.visibilite,p.groupe_id,p.espace_id,e.statut AS espace_statut,e.stripe_account_id,
      o.description,o.prix_centimes,o.capacite,o.active,o.debut_action,o.lieu_action,
      ((SELECT count(*) FROM inscription_payante_projet i WHERE i.projet_id=p.id AND
        i.statut IN ('PAYE','REMBOURSEMENT_EN_COURS','EN_ATTENTE'))
       +(SELECT count(*) FROM inscription_gratuite_projet f WHERE f.projet_id=p.id AND f.statut='CONFIRMEE')) AS reservees
      FROM projet p JOIN espace_organisateur e ON e.id=p.espace_id
      JOIN offre_participation_projet o ON o.projet_id=p.id
      WHERE p.id=?
      """,id);
    if(rows.isEmpty()) throw fail(HttpStatus.NOT_FOUND,"Offre indisponible.");
    var r=rows.getFirst();
    if(onlyPublished) {
      boolean visible=Boolean.TRUE.equals(r.get("publie")) && !Boolean.TRUE.equals(r.get("masque_moderation")) && "APPROUVE".equals(r.get("statut")) && "ACTIF".equals(r.get("espace_statut"));
      if(r.get("groupe_id")!=null) {
        visible &= !jdbc.queryForList("SELECT id FROM groupe WHERE id=? AND statut='ACTIF'",r.get("groupe_id")).isEmpty();
        if("GROUPE".equals(r.get("visibilite"))) visible &= uid!=null && !jdbc.queryForList("""
          SELECT ag.groupe_id FROM appartenance_groupe ag JOIN appartenance_espace ae
          ON ae.utilisateur_id=ag.utilisateur_id AND ae.espace_id=ag.espace_id
          WHERE ag.groupe_id=? AND ag.utilisateur_id=? AND ag.statut='ACTIF' AND ae.statut='ACTIF'
          """,r.get("groupe_id"),uid).isEmpty();
      }
      if(!visible) throw fail(HttpStatus.NOT_FOUND,"Offre indisponible.");
    }
    int left=((Number)r.get("capacite")).intValue()-((Number)r.get("reservees")).intValue();
    Object rawStart=r.get("debut_action");
    OffsetDateTime startsAt=rawStart instanceof OffsetDateTime value?value
      : rawStart instanceof java.sql.Timestamp timestamp?timestamp.toInstant().atOffset(java.time.ZoneOffset.UTC):null;
    return new Offer(id,(String)r.get("description"),((Number)r.get("prix_centimes")).longValue(),
      ((Number)r.get("capacite")).intValue(),Math.max(0,left),Boolean.TRUE.equals(r.get("active")),
      (((Number)r.get("prix_centimes")).longValue()==0 ||
        (r.get("stripe_account_id")!=null && key.startsWith("sk_test_") && webhook.startsWith("whsec_")))
        && startsAt!=null && startsAt.isAfter(OffsetDateTime.now()) && r.get("lieu_action")!=null,
      commissions.percent(((Number)r.get("espace_id")).longValue()),startsAt,(String)r.get("lieu_action"));
  }
  @GetMapping("/offer/{projectId}")
  public ResponseEntity<Offer> publicOffer(Authentication auth,@PathVariable long projectId) {
    Long uid=auth==null?null:user(auth);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(offer(projectId,true,uid));
  }
  @GetMapping("/manage/{projectId}")
  public Offer managedOffer(Authentication auth,@PathVariable long projectId) {
    admin(user(auth),projectId,true);
    return offer(projectId,false,null);
  }
  @PutMapping("/manage/{projectId}")
  public Offer saveOffer(Authentication auth,@PathVariable long projectId,@Valid @RequestBody OfferInput body) {
    long uid=user(auth);
    OffsetDateTime startsAt=body.startsAt().atZone(ZoneId.of("Europe/Brussels")).toOffsetDateTime();
    if(!startsAt.isAfter(OffsetDateTime.now())) throw fail(HttpStatus.BAD_REQUEST,"Le départ ou la première rencontre doit être à une date future.");
    if(body.priceCents()>0 && body.priceCents()<100) throw fail(HttpStatus.BAD_REQUEST,"Le prix doit être gratuit ou d’au moins 1 €.");
    return tx.execute(s->{
      admin(uid,projectId);
      jdbc.queryForList("SELECT id FROM projet WHERE id=? FOR UPDATE",projectId);
      var existing=jdbc.queryForList("SELECT projet_id FROM offre_participation_projet WHERE projet_id=? FOR UPDATE",projectId);
      if(!existing.isEmpty() && !jdbc.queryForList("""
        SELECT id FROM inscription_payante_projet WHERE projet_id=? AND
        statut IN ('PAYE','REMBOURSEMENT_EN_COURS','EN_ATTENTE') LIMIT 1
        """,projectId).isEmpty()) throw fail(HttpStatus.CONFLICT,"Des places sont réservées ou payées. L'offre ne peut plus être modifiée.");
      if(!existing.isEmpty() && Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM inscription_gratuite_projet WHERE projet_id=? AND statut='CONFIRMEE')",Boolean.class,projectId)))
        throw fail(HttpStatus.CONFLICT,"Des personnes sont inscrites. L’offre ne peut plus être modifiée.");
      jdbc.update("""
        INSERT INTO offre_participation_projet(projet_id,description,prix_centimes,capacite,debut_action,lieu_action)
        VALUES (?,?,?,?,?,?) ON CONFLICT(projet_id) DO UPDATE SET description=excluded.description,
        prix_centimes=excluded.prix_centimes,capacite=excluded.capacite,debut_action=excluded.debut_action,
        lieu_action=excluded.lieu_action,active=true,date_modification=now()
        """,projectId,body.description().trim(),body.priceCents(),body.capacity(),startsAt,body.venue().trim());
      return offer(projectId,false,null);
    });
  }
  private Pending reserve(long uid,Request body) {
    // Lock the offer row to serialize capacity checks and reservations.
    var locked=jdbc.queryForList("SELECT projet_id FROM offre_participation_projet WHERE projet_id=? FOR UPDATE",body.projectId());
    if(locked.isEmpty()) throw fail(HttpStatus.NOT_FOUND,"Offre indisponible.");
    Offer offer=offer(body.projectId(),true,uid);
    if(offer.priceCents()==0) throw fail(HttpStatus.CONFLICT,"Cette inscription est gratuite.");
    if(!offer.active() || !offer.paymentReady()) throw fail(HttpStatus.CONFLICT,"Les inscriptions ne sont pas encore ouvertes ou le projet a commencé.");
    var existing=jdbc.queryForList("SELECT id,projet_id,prix_centimes,commission_centimes,compte_stripe,session_stripe,statut FROM inscription_payante_projet WHERE participant_id=? AND demande=?",uid,body.requestId());
    if(!existing.isEmpty()) {
      var r=existing.getFirst();
      if(((Number)r.get("projet_id")).longValue()!=body.projectId()) throw fail(HttpStatus.CONFLICT,"Cette demande a déjà servi.");
      return new Pending(((Number)r.get("id")).longValue(),body.projectId(),"",((Number)r.get("prix_centimes")).longValue(),
        ((Number)r.get("commission_centimes")).longValue(),(String)r.get("compte_stripe"),(String)r.get("session_stripe"),(String)r.get("statut"));
    }
    if(offer.placesLeft()<1) throw fail(HttpStatus.CONFLICT,"Toutes les places sont réservées.");
    if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM inscription_gratuite_projet WHERE projet_id=? AND participant_id=? AND statut='CONFIRMEE')",Boolean.class,body.projectId(),uid)))
      throw fail(HttpStatus.CONFLICT,"Vous êtes déjà inscrit à ce projet.");
    var project=jdbc.queryForMap("SELECT p.titre,p.espace_id,e.stripe_account_id FROM projet p JOIN espace_organisateur e ON e.id=p.espace_id WHERE p.id=?",body.projectId());
    String account=(String)project.get("stripe_account_id");
    if(account==null) throw fail(HttpStatus.CONFLICT,"Le paiement de l'organisateur n'est pas encore prêt.");
    long fee=commissions.cents(((Number)project.get("espace_id")).longValue(),offer.priceCents());
    long id=jdbc.queryForObject("""
      INSERT INTO inscription_payante_projet(projet_id,participant_id,demande,prix_centimes,commission_centimes,compte_stripe,expiration)
      VALUES (?,?,?,?,?,?,now()+interval '35 minutes') RETURNING id
      """,Long.class,body.projectId(),uid,body.requestId(),offer.priceCents(),fee,account);
    return new Pending(id,body.projectId(),(String)project.get("titre"),offer.priceCents(),fee,account,null,"EN_ATTENTE");
  }
  private FreeEnrollment freeEnrollment(long id,long uid) {
    return jdbc.query("""
      SELECT f.id,f.projet_id,p.titre,f.statut,f.date_creation
      FROM inscription_gratuite_projet f JOIN projet p ON p.id=f.projet_id
      WHERE f.id=? AND f.participant_id=?
      """,(r,n)->new FreeEnrollment(r.getLong(1),r.getLong(2),r.getString(3),r.getString(4),r.getObject(5,OffsetDateTime.class)),id,uid)
      .stream().findFirst().orElseThrow(()->fail(HttpStatus.NOT_FOUND,"Inscription introuvable."));
  }
  @PostMapping("/free/{projectId}")
  public FreeEnrollment joinFree(Authentication auth,@PathVariable long projectId) {
    long uid=user(auth);
    return tx.execute(s->{
      if(jdbc.queryForList("SELECT projet_id FROM offre_participation_projet WHERE projet_id=? FOR UPDATE",projectId).isEmpty())
        throw fail(HttpStatus.NOT_FOUND,"Inscriptions indisponibles.");
      Offer available=offer(projectId,true,uid);
      if(available.priceCents()!=0) throw fail(HttpStatus.CONFLICT,"Cette inscription nécessite un paiement.");
      if(!available.active() || !available.paymentReady()) throw fail(HttpStatus.CONFLICT,"Les inscriptions à ce projet sont fermées.");
      var prior=jdbc.queryForList("SELECT id,statut FROM inscription_gratuite_projet WHERE projet_id=? AND participant_id=? FOR UPDATE",projectId,uid);
      if(!prior.isEmpty() && "CONFIRMEE".equals(prior.getFirst().get("statut")))
        return freeEnrollment(((Number)prior.getFirst().get("id")).longValue(),uid);
      if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM inscription_payante_projet WHERE projet_id=? AND participant_id=? AND statut IN ('EN_ATTENTE','PAYE','REMBOURSEMENT_EN_COURS'))",Boolean.class,projectId,uid)))
        throw fail(HttpStatus.CONFLICT,"Vous avez déjà une participation à ce projet.");
      if(available.placesLeft()<1) throw fail(HttpStatus.CONFLICT,"Toutes les places sont réservées.");
      long id;
      if(prior.isEmpty()) id=jdbc.queryForObject("INSERT INTO inscription_gratuite_projet(projet_id,participant_id) VALUES (?,?) RETURNING id",Long.class,projectId,uid);
      else {
        id=((Number)prior.getFirst().get("id")).longValue();
        jdbc.update("UPDATE inscription_gratuite_projet SET statut='CONFIRMEE',date_annulation=NULL WHERE id=?",id);
      }
      return freeEnrollment(id,uid);
    });
  }
  @GetMapping("/free")
  public ResponseEntity<List<FreeEnrollment>> mineFree(Authentication auth) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(jdbc.query("""
      SELECT f.id,f.projet_id,p.titre,f.statut,f.date_creation
      FROM inscription_gratuite_projet f JOIN projet p ON p.id=f.projet_id
      WHERE f.participant_id=? ORDER BY f.date_creation DESC
      """,(r,n)->new FreeEnrollment(r.getLong(1),r.getLong(2),r.getString(3),r.getString(4),r.getObject(5,OffsetDateTime.class)),user(auth)));
  }
  @PostMapping("/free/{id}/cancel")
  public FreeEnrollment cancelFree(Authentication auth,@PathVariable long id) {
    long uid=user(auth);
    return tx.execute(s->{
      var rows=jdbc.queryForList("SELECT projet_id FROM inscription_gratuite_projet WHERE id=? AND participant_id=?",id,uid);
      if(rows.isEmpty()) throw fail(HttpStatus.NOT_FOUND,"Inscription introuvable.");
      long projectId=((Number)rows.getFirst().get("projet_id")).longValue();
      jdbc.queryForList("SELECT projet_id FROM offre_participation_projet WHERE projet_id=? FOR UPDATE",projectId);
      OffsetDateTime startsAt=jdbc.queryForObject("SELECT debut_action FROM offre_participation_projet WHERE projet_id=?",
        (r,n)->r.getObject(1,OffsetDateTime.class),projectId);
      var enrollment=freeEnrollment(id,uid);
      if("ANNULEE".equals(enrollment.status())) return enrollment;
      if(startsAt!=null && !startsAt.isAfter(OffsetDateTime.now())) throw fail(HttpStatus.CONFLICT,"Le projet a déjà commencé.");
      jdbc.update("UPDATE inscription_gratuite_projet SET statut='ANNULEE',date_annulation=now() WHERE id=?",id);
      return freeEnrollment(id,uid);
    });
  }
  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  public Checkout checkout(Authentication auth,@Valid @RequestBody Request body) {
    long uid=user(auth);
    options(null);
    Pending p=tx.execute(s->reserve(uid,body));
    if(!"EN_ATTENTE".equals(p.status())) throw fail(HttpStatus.CONFLICT,"Cette inscription est déjà traitée.");
    try {
      Account account=Account.retrieve(p.account(),options(null));
      if(!Boolean.TRUE.equals(account.getChargesEnabled()) || !Boolean.TRUE.equals(account.getPayoutsEnabled()))
        throw fail(HttpStatus.CONFLICT,"Le compte de l'organisateur n'est pas prêt.");
      Session session;
      if(p.session()!=null) session=Session.retrieve(p.session(),options(null));
      else {
        String title=p.title().isBlank()?"Participation à un projet": "Participation au projet : "+p.title();
        var params=SessionCreateParams.builder().setMode(SessionCreateParams.Mode.PAYMENT)
          .addAllowedPaymentMethodType(SessionCreateParams.AllowedPaymentMethodType.CARD)
          .setClientReferenceId("project-participation-"+p.id())
          .setExpiresAt((System.currentTimeMillis()/1000)+1800)
          .setSuccessUrl(publicUrl+"/projets/"+p.projectId()+"?participation="+p.id())
          .setCancelUrl(publicUrl+"/projets/"+p.projectId()+"?participation=annule")
          .addLineItem(SessionCreateParams.LineItem.builder().setQuantity(1L)
            .setPriceData(SessionCreateParams.LineItem.PriceData.builder().setCurrency("eur").setUnitAmount(p.price())
              .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder().setName(title).build()).build()).build())
          .setPaymentIntentData(SessionCreateParams.PaymentIntentData.builder().setApplicationFeeAmount(p.fee())
            .setTransferData(SessionCreateParams.PaymentIntentData.TransferData.builder().setDestination(p.account()).build()).build()).build();
        session=Session.create(params,options("belconnect-paid-project-"+p.id()+"-v1"));
        jdbc.update("UPDATE inscription_payante_projet SET session_stripe=? WHERE id=? AND session_stripe IS NULL",session.getId(),p.id());
      }
      if(jdbc.queryForObject("SELECT active FROM offre_participation_projet WHERE projet_id=?",Boolean.class,p.projectId())==Boolean.FALSE) {
        if("open".equals(session.getStatus())) session.expire(options(null));
        throw fail(HttpStatus.CONFLICT,"Cette participation vient de fermer.");
      }
      if(session.getUrl()==null || !session.getUrl().startsWith("https://checkout.stripe.com/"))
        throw fail(HttpStatus.CONFLICT,"Cette session a expiré. Recommencez.");
      return new Checkout(p.id(),session.getUrl(),"EN_ATTENTE");
    } catch(StripeException ex) { throw fail(HttpStatus.BAD_GATEWAY,"Stripe est temporairement indisponible."); }
  }
  @GetMapping
  public ResponseEntity<List<Enrollment>> mine(Authentication auth) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(jdbc.query("""
      SELECT i.id,i.projet_id,p.titre,i.prix_centimes,i.statut,i.date_creation
      FROM inscription_payante_projet i JOIN projet p ON p.id=i.projet_id
      WHERE i.participant_id=? ORDER BY i.date_creation DESC LIMIT 50
      """,(r,n)->new Enrollment(r.getLong(1),r.getLong(2),r.getString(3),r.getLong(4),r.getString(5),r.getObject(6,OffsetDateTime.class)),user(auth)));
  }
  @GetMapping("/{id}")
  public ResponseEntity<Enrollment> mineOne(Authentication auth,@PathVariable long id) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(jdbc.query("""
      SELECT i.id,i.projet_id,p.titre,i.prix_centimes,i.statut,i.date_creation
      FROM inscription_payante_projet i JOIN projet p ON p.id=i.projet_id
      WHERE i.id=? AND i.participant_id=?
      """,(r,n)->new Enrollment(r.getLong(1),r.getLong(2),r.getString(3),r.getLong(4),r.getString(5),r.getObject(6,OffsetDateTime.class)),id,user(auth)).stream().findFirst()
      .orElseThrow(()->fail(HttpStatus.NOT_FOUND,"Participation introuvable.")));
  }
  @PostMapping("/manage/{projectId}/cancel")
  public Offer cancel(Authentication auth,@PathVariable long projectId) {
    long uid=user(auth);
    admin(uid,projectId,true);
    tx.executeWithoutResult(s->{
      jdbc.queryForList("SELECT projet_id FROM offre_participation_projet WHERE projet_id=? FOR UPDATE",projectId);
      jdbc.update("UPDATE offre_participation_projet SET active=false,date_modification=now() WHERE projet_id=?",projectId);
      jdbc.update("UPDATE inscription_gratuite_projet SET statut='ANNULEE',date_annulation=now() WHERE projet_id=? AND statut='CONFIRMEE'",projectId);
    });
    cancellation.process(projectId);
    return offer(projectId,false,null);
  }
}
