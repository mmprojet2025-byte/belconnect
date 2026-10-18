package be.belconnect.backend.activity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/managed-activities")
public class ActivityManagementController {
    private final JdbcTemplate jdbc;
    public ActivityManagementController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
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
      boolean published,long version,int bookings,Content content) {}
    private ResponseStatusException error(HttpStatus code,String text) { return new ResponseStatusException(code,text); }
    private long user(Authentication auth) {
      return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF' FOR SHARE",(r,n)->r.getLong(1),auth.getName()).stream().findFirst()
        .orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    private void admin(long user,long space,Long group) {
      if(jdbc.queryForList("SELECT id FROM espace_organisateur WHERE id=? AND statut='ACTIF' FOR UPDATE",space).isEmpty()
        || jdbc.queryForList("SELECT id FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=? AND role='ADMINISTRATEUR' AND statut='ACTIF' FOR SHARE",space,user).isEmpty())
        throw error(HttpStatus.FORBIDDEN,"Cette action est réservée à un administrateur actif de cet espace.");
      if(group!=null && jdbc.queryForList("SELECT id FROM groupe WHERE id=? AND espace_id=? AND statut='ACTIF' FOR SHARE",group,space).isEmpty())
        throw error(HttpStatus.CONFLICT,"Le groupe choisi doit être actif et appartenir à cet espace.");
    }
    private void dates(Content c) {
      if(!c.startsAt().isAfter(OffsetDateTime.now()) || !c.closesAt().isAfter(OffsetDateTime.now()) || c.closesAt().isAfter(c.startsAt()))
        throw error(HttpStatus.BAD_REQUEST,"Le début et la clôture doivent être futurs. La clôture ne peut pas dépasser le début.");
    }
    private List<Activity> read(String where,Object... args) {
      return jdbc.query("""
        SELECT a.*,e.nom AS espace_nom,g.nom AS groupe_nom,
        (SELECT count(*) FROM inscription_activite i WHERE i.activite_id=a.id AND i.statut='CONFIRMEE') AS inscriptions
        FROM activite a JOIN espace_organisateur e ON e.id=a.espace_id LEFT JOIN groupe g ON g.id=a.groupe_id
        """+where+" ORDER BY a.date_creation DESC,a.id DESC",(r,n)->new Activity(r.getLong("id"),r.getString("slug"),r.getLong("espace_id"),r.getObject("groupe_id",Long.class),r.getString("espace_nom"),r.getString("groupe_nom"),r.getBoolean("publiee"),r.getLong("version"),r.getInt("inscriptions"),
          new Content(r.getString("titre"),r.getString("categorie"),r.getString("ville"),r.getString("lieu"),r.getBigDecimal("prix"),r.getString("image"),r.getObject("debut",OffsetDateTime.class),r.getObject("cloture_inscriptions",OffsetDateTime.class),r.getString("description"),r.getString("duree"),r.getInt("capacite"),r.getString("public_cible"),r.getString("rendez_vous"),r.getString("preparation"),r.getString("visibilite"))),args);
    }
    private Activity activity(long id) { return read("WHERE a.id=?",id).stream().findFirst().orElseThrow(()->error(HttpStatus.NOT_FOUND,"Activité introuvable.")); }
    private Activity lock(long user,long id) {
      var a=activity(id);admin(user,a.spaceId(),a.groupId());
      jdbc.queryForList("SELECT id FROM activite WHERE id=? FOR UPDATE",id);return activity(id);
    }
    private void version(Activity a,long v) { if(a.version()!=v) throw error(HttpStatus.CONFLICT,"Cette activité a changé. Actualisez la liste avant de réessayer."); }
    private void audit(long id,long actor,String action,long version) { jdbc.update("INSERT INTO historique_gestion_activite(activite_id,acteur_id,action,version) VALUES (?,?,?,?)",id,actor,action,version); }
    @GetMapping @Transactional
    public List<Activity> list(Authentication auth) {
      long u=user(auth);return read("WHERE e.statut='ACTIF' AND EXISTS (SELECT 1 FROM appartenance_espace ae WHERE ae.espace_id=a.espace_id AND ae.utilisateur_id=? AND ae.role='ADMINISTRATEUR' AND ae.statut='ACTIF')",u);
    }
    @PostMapping @Transactional @ResponseStatus(HttpStatus.CREATED)
    public Activity create(Authentication auth,@Valid @RequestBody Creation body) {
      long u=user(auth);admin(u,body.spaceId(),body.groupId());dates(body.content());
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
      if(a.published() || a.bookings()>0) throw error(HttpStatus.CONFLICT,"Seul un brouillon sans inscription confirmée peut être modifié.");
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
      if(a.published()==body.published()) return a;
      if(body.published()) {
        dates(a.content());
        if(a.content().price().signum()!=0) throw error(HttpStatus.CONFLICT,"La publication payante sera disponible après connexion du service de paiement. Votre brouillon est conservé.");
      } else if(a.bookings()>0) throw error(HttpStatus.CONFLICT,"Cette activité a des inscriptions confirmées. Le retrait nécessite un parcours d’annulation qui n’est pas encore disponible.");
      jdbc.update("UPDATE activite SET publiee=?,version=version+1 WHERE id=?",body.published(),id);
      audit(id,u,body.published()?"ACTIVITE_PUBLIEE":"PUBLICATION_RETIREE",a.version()+1);return activity(id);
    }
}
