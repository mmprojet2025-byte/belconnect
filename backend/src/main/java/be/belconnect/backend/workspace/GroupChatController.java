package be.belconnect.backend.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/mobile/group-messages")
public class GroupChatController {
    private final JdbcTemplate jdbc;
    public GroupChatController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Send(@NotNull UUID requestId, @NotBlank @Size(max = 2000) String content) {}
    public record Read(@NotNull Long lastSeenId) {}
    public record GroupConversation(long groupId, String groupName, String spaceName, String lastMessage,
                                    OffsetDateTime lastAt, long unreadCount) {}
    public record Message(long id, long senderId, String senderName, String content, OffsetDateTime createdAt, boolean mine) {}

    private long user(Authentication auth) {
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter.");
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'", (r, n) -> r.getLong(1), auth.getName())
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter."));
    }

    private void member(long groupId, long actor, boolean lock) {
        String suffix = lock ? " FOR SHARE OF g,e,ae" : "";
        var allowed = jdbc.query("""
            SELECT ae.role FROM groupe g
            JOIN espace_organisateur e ON e.id=g.espace_id
            JOIN appartenance_espace ae ON ae.espace_id=g.espace_id AND ae.utilisateur_id=? AND ae.statut='ACTIF'
            WHERE g.id=? AND g.statut='ACTIF' AND e.statut='ACTIF'
              AND (ae.role='ADMINISTRATEUR' OR EXISTS (
                SELECT 1 FROM appartenance_groupe ag WHERE ag.groupe_id=g.id
                  AND ag.utilisateur_id=ae.utilisateur_id AND ag.statut='ACTIF'))
            """ + suffix, (r, n) -> r.getString(1), actor, groupId);
        if (allowed.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Discussion indisponible.");
        if (lock && !allowed.getFirst().equals("ADMINISTRATEUR")) {
            // Lock the membership too, so a removal cannot race with sending.
            if (jdbc.query("SELECT groupe_id FROM appartenance_groupe WHERE groupe_id=? AND utilisateur_id=? AND statut='ACTIF' FOR SHARE",
                (r, n) -> r.getLong(1), groupId, actor).isEmpty())
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Discussion indisponible.");
        }
    }

    private Message map(java.sql.ResultSet r, int n) throws java.sql.SQLException {
        return new Message(r.getLong("id"), r.getLong("expediteur_id"),
            r.getString("prenom") + " " + r.getString("nom"), r.getString("contenu"),
            r.getObject("date_creation", OffsetDateTime.class), r.getBoolean("mine"));
    }

    @GetMapping("/conversations")
    @Transactional(readOnly = true)
    public ResponseEntity<List<GroupConversation>> conversations(Authentication auth) {
        long actor = user(auth);
        var items = jdbc.query("""
            SELECT g.id,g.nom,e.nom AS espace_nom,
              (SELECT m.contenu FROM message_groupe m WHERE m.groupe_id=g.id ORDER BY m.id DESC LIMIT 1) AS dernier_message,
              (SELECT m.date_creation FROM message_groupe m WHERE m.groupe_id=g.id ORDER BY m.id DESC LIMIT 1) AS derniere_date,
              (SELECT count(*) FROM message_groupe m WHERE m.groupe_id=g.id AND m.id>COALESCE(l.dernier_message_id,0)
                 AND m.expediteur_id<>?) AS non_lus
            FROM groupe g JOIN espace_organisateur e ON e.id=g.espace_id
            JOIN appartenance_espace ae ON ae.espace_id=g.espace_id AND ae.utilisateur_id=? AND ae.statut='ACTIF'
            LEFT JOIN lecture_message_groupe l ON l.groupe_id=g.id AND l.utilisateur_id=?
            WHERE g.statut='ACTIF' AND e.statut='ACTIF'
              AND (ae.role='ADMINISTRATEUR' OR EXISTS (
                SELECT 1 FROM appartenance_groupe ag WHERE ag.groupe_id=g.id
                  AND ag.utilisateur_id=ae.utilisateur_id AND ag.statut='ACTIF'))
            ORDER BY derniere_date DESC NULLS LAST,g.nom LIMIT 100
            """, (r, n) -> new GroupConversation(r.getLong("id"), r.getString("nom"), r.getString("espace_nom"),
                r.getString("dernier_message"), r.getObject("derniere_date", OffsetDateTime.class), r.getLong("non_lus")),
            actor, actor, actor);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(items);
    }

    @GetMapping("/groups/{groupId}/items")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Message>> messages(@PathVariable long groupId, @RequestParam(required = false) Long before,
                                                    Authentication auth) {
        long actor = user(auth);
        member(groupId, actor, false);
        var items = jdbc.query("""
            SELECT m.id,m.expediteur_id,m.contenu,m.date_creation,u.prenom,u.nom,m.expediteur_id=? AS mine
            FROM message_groupe m JOIN utilisateur u ON u.id=m.expediteur_id
            WHERE m.groupe_id=? AND (CAST(? AS BIGINT) IS NULL OR m.id<?)
            ORDER BY m.id DESC LIMIT 30
            """, this::map, actor, groupId, before, before);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(items);
    }

    @PostMapping("/groups/{groupId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Message send(@PathVariable long groupId, @Valid @RequestBody Send body, Authentication auth) {
        long actor = user(auth);
        member(groupId, actor, true);
        String content = body.content().strip();
        if (content.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le message est vide.");
        var previous = jdbc.query("SELECT id,groupe_id,contenu FROM message_groupe WHERE expediteur_id=? AND demande=?",
            (r, n) -> new Previous(r.getLong(1), r.getLong(2), r.getString(3)), actor, body.requestId());
        if (!previous.isEmpty()) {
            var old = previous.getFirst();
            if (old.groupId() != groupId || !old.content().equals(content))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette demande a déjà été utilisée.");
            return jdbc.queryForObject("""
                SELECT m.id,m.expediteur_id,m.contenu,m.date_creation,u.prenom,u.nom,m.expediteur_id=? AS mine
                FROM message_groupe m JOIN utilisateur u ON u.id=m.expediteur_id WHERE m.id=?
                """, this::map, actor, old.id());
        }
        long recent = jdbc.queryForObject("SELECT count(*) FROM message_groupe WHERE expediteur_id=? AND date_creation>now()-interval '1 minute'",
            Long.class, actor);
        if (recent >= 20) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Attendez avant d’envoyer d’autres messages.");
        long id = jdbc.queryForObject("INSERT INTO message_groupe(groupe_id,expediteur_id,contenu,demande) VALUES (?,?,?,?) RETURNING id",
            Long.class, groupId, actor, content, body.requestId());
        return jdbc.queryForObject("""
            SELECT m.id,m.expediteur_id,m.contenu,m.date_creation,u.prenom,u.nom,m.expediteur_id=? AS mine
            FROM message_groupe m JOIN utilisateur u ON u.id=m.expediteur_id WHERE m.id=?
            """, this::map, actor, id);
    }

    @PostMapping("/groups/{groupId}/read")
    @Transactional
    public ResponseEntity<Void> read(@PathVariable long groupId, @Valid @RequestBody Read body, Authentication auth) {
        long actor = user(auth);
        member(groupId, actor, false);
        if (body.lastSeenId() < 0 || (body.lastSeenId() > 0 && !Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM message_groupe WHERE id=? AND groupe_id=?)", Boolean.class, body.lastSeenId(), groupId))))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message inconnu.");
        jdbc.update("""
            INSERT INTO lecture_message_groupe(groupe_id,utilisateur_id,dernier_message_id) VALUES (?,?,?)
            ON CONFLICT (groupe_id,utilisateur_id) DO UPDATE
            SET dernier_message_id=GREATEST(lecture_message_groupe.dernier_message_id,EXCLUDED.dernier_message_id)
            """, groupId, actor, body.lastSeenId());
        return ResponseEntity.noContent().build();
    }

    private record Previous(long id, long groupId, String content) {}
}
