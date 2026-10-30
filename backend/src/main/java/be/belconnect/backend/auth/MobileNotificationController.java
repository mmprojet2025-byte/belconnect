package be.belconnect.backend.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/mobile")
public class MobileNotificationController {
  private final JdbcTemplate jdbc;
  public MobileNotificationController(JdbcTemplate jdbc){this.jdbc=jdbc;}
  public record Notice(String source,long id,String title,String message,OffsetDateTime createdAt,OffsetDateTime readAt,Long activityId){}
  public record Device(@NotBlank String deviceId,@NotBlank @Pattern(regexp="^(Expo(nent)?PushToken)\\[[A-Za-z0-9_-]+]$") String expoPushToken,
    @Pattern(regexp="android|ios") String platform){}
  private long user(Authentication auth){return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName()).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));}
  @GetMapping("/notifications") public List<Notice> list(Authentication auth){long user=user(auth);return jdbc.query("""
    SELECT source,id,title,message,created_at,read_at,activity_id FROM (
      SELECT 'activity' source,n.id,a.titre title,'Votre réservation a été annulée car cette activité est annulée.' message,n.date_creation created_at,n.date_lecture read_at,n.activite_id activity_id FROM notification_activite n JOIN activite a ON a.id=n.activite_id WHERE n.utilisateur_id=?
      UNION ALL SELECT 'workspace',n.id,d.nom,CASE n.evenement WHEN 'DEMANDE_RECUE' THEN 'Nouvelle demande d’espace reçue.' WHEN 'DEMANDE_APPROUVEE' THEN 'Votre demande d’espace a été approuvée.' ELSE 'Votre demande d’espace a été refusée.' END,n.date_creation,n.date_lecture,NULL FROM notification_demande_espace n JOIN demande_espace d ON d.id=n.demande_id WHERE n.utilisateur_id=?
      UNION ALL SELECT 'group',n.id,g.nom,CASE n.evenement WHEN 'DEMANDE_RECUE' THEN 'Nouvelle demande d’adhésion reçue.' WHEN 'DEMANDE_ACCEPTEE' THEN 'Votre adhésion a été acceptée.' ELSE 'Votre adhésion a été refusée.' END,n.date_creation,n.date_lecture,NULL FROM notification_adhesion_groupe n JOIN demande_adhesion_groupe d ON d.id=n.demande_id JOIN groupe g ON g.id=d.groupe_id WHERE n.utilisateur_id=?
    ) notices ORDER BY created_at DESC,id DESC LIMIT 50
    """,(r,n)->new Notice(r.getString(1),r.getLong(2),r.getString(3),r.getString(4),r.getObject(5,OffsetDateTime.class),r.getObject(6,OffsetDateTime.class),r.getObject(7,Long.class)),user,user,user);}
  @PostMapping("/notifications/{source}/{id}/read") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
  public void read(Authentication auth,@PathVariable String source,@PathVariable long id){long user=user(auth);String table=switch(source){case "activity"->"notification_activite";case "workspace"->"notification_demande_espace";case "group"->"notification_adhesion_groupe";default->throw new ResponseStatusException(HttpStatus.NOT_FOUND);};if(jdbc.update("UPDATE "+table+" SET date_lecture=now() WHERE id=? AND utilisateur_id=?",id,user)==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
  @PostMapping("/devices") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
  public void device(Authentication auth,@Valid @RequestBody Device body){UUID id;try{id=UUID.fromString(body.deviceId());}catch(IllegalArgumentException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Appareil invalide.");}jdbc.update("DELETE FROM appareil_push_mobile WHERE jeton_expo=? AND id_appareil<>?",body.expoPushToken(),id);jdbc.update("""
    INSERT INTO appareil_push_mobile(id_appareil,utilisateur_id,jeton_expo,plateforme) VALUES (?,?,?,?)
    ON CONFLICT (id_appareil) DO UPDATE SET utilisateur_id=excluded.utilisateur_id,jeton_expo=excluded.jeton_expo,plateforme=excluded.plateforme,date_maj=now()
    """,id,user(auth),body.expoPushToken(),body.platform());}
}
