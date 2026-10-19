package be.belconnect.backend.activity;

import be.belconnect.backend.booking.PaidActivityCancellation;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.net.RequestOptions;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/managed-activities")
public class ActivityManagementController {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final PaidActivityCancellation paidCancellation;
    private final String stripeKey,webhookSecret;
    public ActivityManagementController(JdbcTemplate jdbc,TransactionTemplate tx,PaidActivityCancellation paidCancellation,
        @Value("${STRIPE_SECRET_KEY:}") String stripeKey,@Value("${STRIPE_WEBHOOK_SECRET:}") String webhookSecret) {
      this.jdbc=jdbc; this.tx=tx; this.paidCancellation=paidCancellation;
      this.stripeKey=stripeKey; this.webhookSecret=webhookSecret;
    }
    public record Content(@NotBlank @Size(min=5,max=250) String title,
      @NotNull @Pattern(regexp="art|gastronomie|nature|culture|savoir-faire|bien-etre") String category,
      @NotBlank @Size(max=120) String city,@NotBlank @Size(max=250) String location,
      @NotNull @DecimalMin("0.00") @DecimalMax("99999999.99") @Digits(integer=8,fraction=2) BigDecimal price,
      @NotNull @Pattern(regexp="balade|brasserie|ceramique|chocolat|cinema|potager|randonnee|street-art|velo") String image,
      @NotNull OffsetDateTime startsAt,@NotNull OffsetDateTime closesAt,
      @NotBlank @Size(max=10000) String description,@NotBlank @Size(max=80) String duration,
      @NotNull @Min(1) @Max(100000) Integer capacity,
      @NotBlank @Size(max=200) String audience,@NotBlank @Size(max=250) String meetingPoint,
      @NotNull @Size(max=3000) String preparation,
      @NotNull @Pattern(regexp="PUBLIQUE|PRIVEE") String visibility) {
        public Content {
          if(price!=null) price=price.stripTrailingZeros();
          if(startsAt!=null) startsAt=startsAt.withOffsetSameInstant(java.time.ZoneOffset.UTC);
          if(closesAt!=null) closesAt=closesAt.withOffsetSameInstant(java.time.ZoneOffset.UTC);
        }
      }
    public record Creation(@NotNull UUID requestId,@NotNull Long spaceId,Long groupId,@NotNull @Valid Content content) {}
    public record Update(@NotNull @Min(0) Long version,@NotNull @Valid Content content) {}
    public record Publication(@NotNull @Min(0) Long version,@NotNull Boolean published) {}
    public record Activity(long id,String slug,long spaceId,Long groupId,String spaceName,String groupName,
      boolean published,boolean cancelled,long version,int bookings,int pendingCancellation,Content content) {}
    private ResponseStatusException error(HttpStatus code,String text) { return new ResponseStatusException(code,text); }
    private long user(Authentication auth) {
      return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),auth.getName()).stream().findFirst()
        .orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    private void access(long user,long space,Long group,boolean write) {
      if(jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? AND statut='ACTIF'"+(write?" FOR UPDATE":" FOR SHARE"),space).isEmpty())
        throw error(HttpStatus.FORBIDDEN,"Cet espace n’est plus accessible.");
      var roles=jdbc.query("SELECT role FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getString(1),space,user);
      if(roles.isEmpty()) throw error(HttpStatus.FORBIDDEN,"Vous ne faites plus partie de cet espace.");
      boolean admin=roles.contains("ADMINISTRATEUR");
      if(group!=null) {
        var g=jdbc.queryForList("SELECT statut,referents_gerent_activites FROM groupe WHERE id=? AND espace_id=? FOR SHARE",group,space);
        if(g.isEmpty() || ((!admin || write) && !"ACTIF".equals(g.getFirst().get("statut"))))
          throw error(HttpStatus.CONFLICT,"Le groupe doit être actif et appartenir à cet espace.");
        if(!admin && !roles.isEmpty() && Boolean.TRUE.equals(g.getFirst().get("referents_gerent_activites"))
          && !jdbc.queryForList("SELECT groupe_id FROM appartenance_groupe WHERE groupe_id=? AND espace_id=? AND utilisateur_id=? AND role='REFERENT' AND statut='ACTIF' FOR SHARE",group,space,user).isEmpty()) return;
      }
      if(!admin) throw error(HttpStatus.FORBIDDEN,"Vous devez être administrateur ou référent autorisé de ce groupe.");
    }
    private void dates(Content c) {
      if(!c.startsAt().isAfter(OffsetDateTime.now()) || !c.closesAt().isAfter(OffsetDateTime.now()) || c.closesAt().isAfter(c.startsAt()))
        throw error(HttpStatus.BAD_REQUEST,"Le début et la clôture doivent être futurs. La clôture ne peut pas dépasser le début.");
    }
    private List<Activity> read(String where,Object... args) {
      return jdbc.query("""
        SELECT a.*,e.nom AS espace_nom,g.nom AS groupe_nom,
        (SELECT count(*) FROM inscription_activite i WHERE i.activite_id=a.id AND i.statut='CONFIRMEE') AS inscriptions,
        (SELECT count(*) FROM reservation_payante_activite r WHERE r.activite_id=a.id
          AND r.statut IN ('EN_ATTENTE','PAYE','REMBOURSEMENT_EN_COURS')) AS paiements_a_traiter
        FROM activite a JOIN espace_organisateur e ON e.id=a.espace_id LEFT JOIN groupe g ON g.id=a.groupe_id
        """+where+" ORDER BY a.date_creation DESC,a.id DESC",(r,n)->new Activity(r.getLong("id"),r.getString("slug"),r.getLong("espace_id"),r.getObject("groupe_id",Long.class),r.getString("espace_nom"),r.getString("groupe_nom"),r.getBoolean("publiee"),r.getBoolean("annulee"),r.getLong("version"),r.getInt("inscriptions"),r.getInt("paiements_a_traiter")+r.getInt("inscriptions"),
          new Content(r.getString("titre"),r.getString("categorie"),r.getString("ville"),r.getString("lieu"),r.getBigDecimal("prix"),r.getString("image"),r.getObject("debut",OffsetDateTime.class),r.getObject("cloture_inscriptions",OffsetDateTime.class),r.getString("description"),r.getString("duree"),r.getInt("capacite"),r.getString("public_cible"),r.getString("rendez_vous"),r.getString("preparation"),r.getString("visibilite"))),args);
    }
    private Activity activity(long id) { return read("WHERE a.id=?",id).stream().findFirst().orElseThrow(()->error(HttpStatus.NOT_FOUND,"Activité introuvable.")); }
    private Activity lock(long user,long id) {
      var a=activity(id);access(user,a.spaceId(),a.groupId(),true);
      jdbc.queryForList("SELECT id FROM activite WHERE id=? FOR UPDATE",id);return activity(id);
    }
    private void version(Activity a,long v) { if(a.version()!=v) throw error(HttpStatus.CONFLICT,"Cette activité a changé. Actualisez la liste avant de réessayer."); }
    private void audit(long id,long actor,String action,long version) { jdbc.update("INSERT INTO historique_gestion_activite(activite_id,acteur_id,action,version) VALUES (?,?,?,?)",id,actor,action,version); }
    @GetMapping @Transactional
    public List<Activity> list(Authentication auth) {
      long u=user(auth);return read("WHERE e.statut='ACTIF' AND EXISTS (SELECT 1 FROM appartenance_espace ae WHERE ae.espace_id=a.espace_id AND ae.utilisateur_id=? AND ae.statut='ACTIF' AND (ae.role='ADMINISTRATEUR' OR (g.statut='ACTIF' AND g.referents_gerent_activites AND EXISTS (SELECT 1 FROM appartenance_groupe ag WHERE ag.groupe_id=a.groupe_id AND ag.espace_id=a.espace_id AND ag.utilisateur_id=ae.utilisateur_id AND ag.statut='ACTIF' AND ag.role='REFERENT'))))",u);
    }
    @PostMapping @Transactional @ResponseStatus(HttpStatus.CREATED)
    public Activity create(Authentication auth,@Valid @RequestBody Creation body) {
      long u=user(auth);access(u,body.spaceId(),body.groupId(),true);dates(body.content());
      var old=jdbc.queryForList("SELECT id FROM activite WHERE createur_id=? AND creation_request=?",u,body.requestId());
      if(!old.isEmpty()) {
        var a=activity(((Number)old.getFirst().get("id")).longValue());
        if(a.spaceId()==body.spaceId() && Objects.equals(a.groupId(),body.groupId()) && a.version()==0 && a.content().equals(body.content())) return a;
        throw error(HttpStatus.CONFLICT,"Cette création a déjà été traitée. Actualisez vos activités.");
      }
      var c=body.content();String host=jdbc.queryForObject("SELECT nom FROM espace_organisateur WHERE id=?",String.class,body.spaceId());
      long id=jdbc.queryForObject("""
        INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,capacite,places_disponibles,
          public_cible,rendez_vous,preparation,espace_id,groupe_id,createur_id,creation_request,visibilite,cloture_inscriptions)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
        """,Long.class,"activite-"+UUID.randomUUID(),c.title(),c.category(),c.city(),c.location(),host,c.price(),c.image(),c.startsAt(),c.description(),c.duration(),c.capacity(),c.capacity(),c.audience(),c.meetingPoint(),c.preparation(),body.spaceId(),body.groupId(),u,body.requestId(),c.visibility(),c.closesAt());
      audit(id,u,"BROUILLON_CREE",0);return activity(id);
    }
    @PostMapping("/{id}") @Transactional
    public Activity edit(Authentication auth,@PathVariable long id,@Valid @RequestBody Update body) {
      long u=user(auth);var a=lock(u,id);version(a,body.version());
      if(a.cancelled() || a.published() || a.bookings()>0) throw error(HttpStatus.CONFLICT,"Seul un brouillon sans inscription confirmée peut être modifié.");
      var c=body.content();dates(c);
      jdbc.update("""
        UPDATE activite SET titre=?,categorie=?,ville=?,lieu=?,prix=?,image=?,debut=?,description=?,duree=?,capacite=?,places_disponibles=?,
          public_cible=?,rendez_vous=?,preparation=?,visibilite=?,cloture_inscriptions=?,version=version+1 WHERE id=?
        """,c.title(),c.category(),c.city(),c.location(),c.price(),c.image(),c.startsAt(),c.description(),c.duration(),c.capacity(),c.capacity(),c.audience(),c.meetingPoint(),c.preparation(),c.visibility(),c.closesAt(),id);
      audit(id,u,"BROUILLON_MODIFIE",a.version()+1);return activity(id);
    }
    @PostMapping("/{id}/publication") @Transactional
    public Activity publish(Authentication auth,@PathVariable long id,@Valid @RequestBody Publication body) {
      long u=user(auth);var a=lock(u,id);version(a,body.version());
      if(a.cancelled()) throw error(HttpStatus.CONFLICT,"Cette activité est annulée et ne peut plus être publiée.");
      if(a.published()==body.published()) return a;
      if(body.published()) {
        dates(a.content());
        if(a.content().price().signum()>0) {
          if(a.content().price().compareTo(new BigDecimal("0.50"))<0
              || a.content().price().compareTo(new BigDecimal("999999.99"))>0)
            throw error(HttpStatus.CONFLICT,"Le tarif payant doit être compris entre 0,50 € et 999 999,99 € par place.");
          if(!stripeKey.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_"))
            throw error(HttpStatus.SERVICE_UNAVAILABLE,"Configurez Stripe en mode test et son webhook avant de publier cette activité payante.");
          String accountId=jdbc.queryForObject("SELECT stripe_account_id FROM espace_organisateur WHERE id=?",String.class,a.spaceId());
          if(accountId==null || !accountId.startsWith("acct_"))
            throw error(HttpStatus.CONFLICT,"Terminez la connexion Stripe de cet espace avant de publier.");
          try {
            Account account=Account.retrieve(accountId,RequestOptions.builder().setApiKey(stripeKey).build());
            if(!Boolean.TRUE.equals(account.getChargesEnabled()) || !Boolean.TRUE.equals(account.getPayoutsEnabled()))
              throw error(HttpStatus.CONFLICT,"Le compte Stripe de l'organisateur n'est pas encore prêt à recevoir les paiements.");
          } catch(StripeException ex) { throw error(HttpStatus.BAD_GATEWAY,"Impossible de vérifier le compte Stripe de l'organisateur."); }
        }
      } else if(a.bookings()>0 || jdbc.queryForObject("SELECT count(*) FROM reservation_payante_activite WHERE activite_id=? AND statut='EN_ATTENTE'",Integer.class,id)>0)
        throw error(HttpStatus.CONFLICT,"Cette activité a des inscriptions ou paiements en cours. Utilisez l’annulation de l’activité.");
      jdbc.update("UPDATE activite SET publiee=?,version=version+1 WHERE id=?",body.published(),id);
      audit(id,u,body.published()?"ACTIVITE_PUBLIEE":"PUBLICATION_RETIREE",a.version()+1);return activity(id);
    }
    public record Cancellation(@NotNull @Min(0) Long version) {}
    @PostMapping("/{id}/cancel") @Transactional
    public Activity cancel(Authentication auth,@PathVariable long id,@Valid @RequestBody Cancellation body) {
      long u=user(auth);var a=lock(u,id);version(a,body.version());
      if(a.content().price().signum()>0)
        throw error(HttpStatus.CONFLICT,"Cette activité payante doit suivre le parcours de remboursement.");
      if(a.cancelled() || !a.published()) throw error(HttpStatus.CONFLICT,"Cette activité ne peut pas être annulée.");
      if(!a.content().startsAt().isAfter(OffsetDateTime.now())) throw error(HttpStatus.CONFLICT,"Cette activité a déjà commencé.");
      jdbc.update("""
        INSERT INTO notification_activite(utilisateur_id,inscription_id,activite_id)
        SELECT utilisateur_id,id,activite_id FROM inscription_activite
        WHERE activite_id=? AND statut='CONFIRMEE'
        ON CONFLICT (inscription_id) DO NOTHING
        """,id);
      jdbc.update("UPDATE activite SET annulee=true,publiee=false,date_annulation=now(),places_disponibles=capacite,version=version+1 WHERE id=?",id);
      jdbc.update("UPDATE inscription_activite SET statut='ANNULEE',date_annulation=now(),version=version+1 WHERE activite_id=? AND statut='CONFIRMEE'",id);
      audit(id,u,"ACTIVITE_ANNULEE",a.version()+1);
      return activity(id);
    }
    @PostMapping("/{id}/cancel-paid")
    public Activity cancelPaid(Authentication auth,@PathVariable long id,@Valid @RequestBody Cancellation body) {
      long u=user(auth);
      tx.executeWithoutResult(status->{
        var a=lock(u,id);
        if(a.content().price().signum()<=0) throw error(HttpStatus.CONFLICT,"Cette activité est gratuite.");
        if(a.cancelled()) return; // Authorized retry after a partial Stripe response.
        version(a,body.version());
        if(!a.published()) throw error(HttpStatus.CONFLICT,"Cette activité n'est pas publiée.");
        if(!a.content().startsAt().isAfter(OffsetDateTime.now())) throw error(HttpStatus.CONFLICT,"Cette activité a déjà commencé.");
        if(!paidCancellation.configured()) throw error(HttpStatus.SERVICE_UNAVAILABLE,"Stripe test n'est pas configuré.");
        // Closing publication first prevents new Checkouts while existing ones are resolved.
        jdbc.update("UPDATE activite SET annulee=true,publiee=false,date_annulation=now(),version=version+1 WHERE id=?",id);
        audit(id,u,"ACTIVITE_ANNULEE",a.version()+1);
      });
      paidCancellation.process(id);
      return activity(id);
    }
    public record Registration(long id,String firstName,String lastName,String email,String phone,int quantity,
      String status,OffsetDateTime registeredAt,OffsetDateTime cancelledAt) {}
    public record Register(long activityId,String title,int capacity,int reserved,int remaining,int confirmed,int cancelled,
      List<Registration> registrations) {}
    private Register register(long actor,long id,String status) {
      if(!Set.of("ALL","CONFIRMEE","ANNULEE").contains(status)) throw error(HttpStatus.BAD_REQUEST,"Filtre d’inscriptions invalide.");
      var activity=activity(id);
      // Admins retain historical access; delegated referents need an active group and permission.
      access(actor,activity.spaceId(),activity.groupId(),false);
      // Bookings, cancellations and edits all lock the activity before changing capacity or registrations.
      var capacity=jdbc.queryForMap("SELECT capacite,places_disponibles FROM activite WHERE id=? FOR SHARE",id);
      var all=jdbc.query("""
        SELECT id,prenom,nom,email,telephone,quantite,statut,date_creation,date_annulation
        FROM inscription_activite WHERE activite_id=? ORDER BY date_creation DESC,id DESC
        """,(r,n)->new Registration(r.getLong("id"),r.getString("prenom"),r.getString("nom"),r.getString("email"),r.getString("telephone"),r.getInt("quantite"),r.getString("statut"),r.getObject("date_creation",OffsetDateTime.class),r.getObject("date_annulation",OffsetDateTime.class)),id);
      int confirmed=(int)all.stream().filter(r->r.status().equals("CONFIRMEE")).count();
      int reserved=all.stream().filter(r->r.status().equals("CONFIRMEE")).mapToInt(Registration::quantity).sum();
      return new Register(id,activity.content().title(),((Number)capacity.get("capacite")).intValue(),reserved,((Number)capacity.get("places_disponibles")).intValue(),confirmed,all.size()-confirmed,
        all.stream().filter(r->status.equals("ALL") || r.status().equals(status)).toList());
    }
    @GetMapping("/{id}/registrations") @Transactional
    public org.springframework.http.ResponseEntity<Register> registrations(Authentication auth,@PathVariable long id,
        @RequestParam(defaultValue="ALL") String status) {
      return org.springframework.http.ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(register(user(auth),id,status));
    }
    private static String csv(String value) {
      String safe=value==null?"":value;
      String leading=safe.stripLeading();
      if(!leading.isEmpty() && "=+-@".indexOf(leading.charAt(0))>=0 || safe.startsWith("\t") || safe.startsWith("\r") || safe.startsWith("\n")) safe="'"+safe;
      return "\""+safe.replace("\"","\"\"")+"\"";
    }
    private static String date(OffsetDateTime value) {
      return value==null?"":value.atZoneSameInstant(java.time.ZoneId.of("Europe/Brussels")).toOffsetDateTime().toString();
    }
    @GetMapping("/{id}/registrations.csv") @Transactional
    public org.springframework.http.ResponseEntity<byte[]> exportRegistrations(Authentication auth,@PathVariable long id,
        @RequestParam(defaultValue="ALL") String status) {
      var data=register(user(auth),id,status);
      var output=new StringBuilder("\uFEFFIdentifiant;Prénom;Nom;E-mail;Téléphone;Places;Statut;Inscription (Bruxelles);Annulation (Bruxelles)\r\n");
      for(var r:data.registrations()) {
        output.append(java.util.stream.Stream.of(Long.toString(r.id()),r.firstName(),r.lastName(),r.email(),r.phone(),Integer.toString(r.quantity()),
          r.status().equals("CONFIRMEE")?"Confirmée":"Annulée",date(r.registeredAt()),date(r.cancelledAt())).map(ActivityManagementController::csv).collect(java.util.stream.Collectors.joining(";"))).append("\r\n");
      }
      return org.springframework.http.ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
        .header("Content-Type","text/csv; charset=UTF-8")
        .header("Content-Disposition","attachment; filename=\"inscriptions-activite-"+id+"-"+status.toLowerCase(java.util.Locale.ROOT)+".csv\"")
        .body(output.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

}
