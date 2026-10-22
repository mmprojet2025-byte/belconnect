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
@RequestMapping("/api/group-memberships/notifications")
public class GroupMembershipNotificationController {
    private final JdbcTemplate jdbc;
    public GroupMembershipNotificationController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Notice(long id,long requestId,long spaceId,String groupName,String event,OffsetDateTime createdAt) {}
    private long user(Authentication auth) {
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Connectez-vous pour voir vos notifications.");
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),auth.getName())
            .stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous reconnecter."));
    }
    @GetMapping @Transactional(readOnly=true)
    public List<Notice> unread(Authentication auth) {
        return jdbc.query("""
            SELECT n.id,n.demande_id,d.espace_id,g.nom,n.evenement,n.date_creation
            FROM notification_adhesion_groupe n
            JOIN demande_adhesion_groupe d ON d.id=n.demande_id
            JOIN groupe g ON g.id=d.groupe_id
            WHERE n.utilisateur_id=? AND n.date_lecture IS NULL
            ORDER BY n.date_creation DESC,n.id DESC LIMIT 30
            """,(r,i)->new Notice(r.getLong(1),r.getLong(2),r.getLong(3),r.getString(4),r.getString(5),r.getObject(6,OffsetDateTime.class)),user(auth));
    }
    @PostMapping("/{id}/read") @Transactional
    public void read(Authentication auth,@PathVariable long id) {
        if(jdbc.update("UPDATE notification_adhesion_groupe SET date_lecture=now() WHERE id=? AND utilisateur_id=? AND date_lecture IS NULL",id,user(auth))==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Notification introuvable ou déjà lue.");
    }
}
