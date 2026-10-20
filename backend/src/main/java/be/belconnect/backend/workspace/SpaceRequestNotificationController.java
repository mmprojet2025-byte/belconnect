package be.belconnect.backend.workspace;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace/notifications")
public class SpaceRequestNotificationController {
    private final JdbcTemplate jdbc;
    public SpaceRequestNotificationController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public record Notice(long id,long requestId,String name,String event,OffsetDateTime createdAt) {}
    private long user(Authentication auth) {
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName())
            .stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    @GetMapping @Transactional(readOnly=true)
    public List<Notice> unread(Authentication auth) {
        return jdbc.query("""
            SELECT n.id,n.demande_id,d.nom,n.evenement,n.date_creation
            FROM notification_demande_espace n JOIN demande_espace d ON d.id=n.demande_id
            WHERE n.utilisateur_id=? AND n.date_lecture IS NULL
            ORDER BY n.date_creation DESC,n.id DESC LIMIT 30
            """,(r,i)->new Notice(r.getLong(1),r.getLong(2),r.getString(3),r.getString(4),r.getObject(5,OffsetDateTime.class)),user(auth));
    }
    @PostMapping("/{id}/read") @Transactional
    public void read(Authentication auth,@PathVariable long id) {
        if(jdbc.update("UPDATE notification_demande_espace SET date_lecture=now() WHERE id=? AND utilisateur_id=? AND date_lecture IS NULL",id,user(auth))==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Notification introuvable ou déjà lue.");
    }
}
