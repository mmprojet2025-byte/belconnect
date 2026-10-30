package be.belconnect.backend.auth;

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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/mobile/messages")
public class PrivateMessageController {
    private final JdbcTemplate jdbc;

    public PrivateMessageController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Member(long id, String name) {}
    public record Start(@NotNull Long groupId, @NotNull Long recipientId) {}
    public record Send(@NotNull UUID requestId, @NotBlank @Size(max = 2000) String content) {}
    public record Report(@NotBlank @Size(max = 500) String reason) {}
    public record Conversation(long id, Long groupId, String groupName, long otherUserId, String otherName,
            String lastMessage, OffsetDateTime lastAt, long unreadCount, boolean blockedByMe, boolean canSend) {}
    public record Message(long id, String content, OffsetDateTime createdAt, OffsetDateTime readAt, boolean mine) {}

    private ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation indisponible."); }

    private long user(Authentication auth) {
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter.");
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'", (row, index) -> row.getLong(1), auth.getName())
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter."));
    }

    private boolean groupMember(long actor, long group, boolean lock) {
        String suffix = lock ? " FOR SHARE" : "";
        var spaces = jdbc.query("""
            SELECT ae.role FROM appartenance_espace ae JOIN groupe g ON g.espace_id=ae.espace_id
              JOIN espace_organisateur e ON e.id=g.espace_id
            WHERE g.id=? AND g.statut='ACTIF' AND e.statut='ACTIF'
              AND ae.utilisateur_id=? AND ae.statut='ACTIF'
            """ + (lock ? " FOR SHARE OF ae,g,e" : ""), (row, index) -> row.getString(1), group, actor);
        if (spaces.isEmpty()) return false;
        if (spaces.getFirst().equals("ADMINISTRATEUR")) return true;
        return !jdbc.query("SELECT groupe_id FROM appartenance_groupe WHERE groupe_id=? AND utilisateur_id=? AND statut='ACTIF'" + suffix,
            (row, index) -> row.getLong(1), group, actor).isEmpty();
    }

    private void sharedGroup(long group, long first, long second, boolean lock) {
        long lower = Math.min(first, second), higher = Math.max(first, second);
        if (!groupMember(lower, group, lock) || !groupMember(higher, group, lock)) throw missing();
    }

    private boolean blocked(long first, long second) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM blocage_message_prive
              WHERE (bloqueur_id=? AND bloque_id=?) OR (bloqueur_id=? AND bloque_id=?))
            """, Boolean.class, first, second, second, first));
    }

    private void allowMessages(long first, long second) {
        if (blocked(first, second)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cette conversation est bloquée.");
    }

    private record Pair(long group, long other) {}

    private Pair pair(long conversation, long actor) {
        return jdbc.query("""
            SELECT groupe_id,CASE WHEN participant_a_id=? THEN participant_b_id ELSE participant_a_id END AS other
            FROM conversation_privee WHERE id=? AND (participant_a_id=? OR participant_b_id=?)
            """, (row, index) -> new Pair(row.getLong("groupe_id"), row.getLong("other")), actor, conversation, actor, actor)
            .stream().findFirst().orElseThrow(this::missing);
    }

    private Conversation summary(java.sql.ResultSet row, int index) throws java.sql.SQLException {
        return new Conversation(row.getLong("id"), (Long) row.getObject("groupe_id"), row.getString("group_name"),
            row.getLong("other_user_id"), row.getString("other_name"), row.getString("last_message"),
            row.getObject("last_at", OffsetDateTime.class), row.getLong("unread_count"),
            row.getBoolean("blocked_by_me"), row.getBoolean("can_send"));
    }

    private static final String SUMMARY = """
        SELECT c.id,c.groupe_id,COALESCE(g.nom,'Ancien groupe') AS group_name,
          CASE WHEN c.participant_a_id=? THEN c.participant_b_id ELSE c.participant_a_id END AS other_user_id,
          CASE WHEN c.participant_a_id=? THEN concat_ws(' ',ub.prenom,ub.nom) ELSE concat_ws(' ',ua.prenom,ua.nom) END AS other_name,
          (SELECT m.contenu FROM message_prive m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
          (SELECT m.date_creation FROM message_prive m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_at,
          (SELECT count(*) FROM message_prive m WHERE m.conversation_id=c.id AND m.expediteur_id<>? AND m.date_lecture IS NULL) AS unread_count,
          EXISTS(SELECT 1 FROM blocage_message_prive b WHERE b.bloqueur_id=? AND b.bloque_id=
            CASE WHEN c.participant_a_id=? THEN c.participant_b_id ELSE c.participant_a_id END) AS blocked_by_me,
          (g.id IS NOT NULL AND g.statut='ACTIF' AND e.statut='ACTIF' AND ua.statut='ACTIF' AND ub.statut='ACTIF'
           AND NOT EXISTS(SELECT 1 FROM blocage_message_prive b WHERE
             (b.bloqueur_id=c.participant_a_id AND b.bloque_id=c.participant_b_id)
             OR (b.bloqueur_id=c.participant_b_id AND b.bloque_id=c.participant_a_id))
           AND EXISTS(SELECT 1 FROM appartenance_espace ae WHERE ae.utilisateur_id=c.participant_a_id AND ae.espace_id=g.espace_id
             AND ae.statut='ACTIF' AND (ae.role='ADMINISTRATEUR' OR EXISTS(SELECT 1 FROM appartenance_groupe ag
               WHERE ag.utilisateur_id=ae.utilisateur_id AND ag.groupe_id=g.id AND ag.statut='ACTIF')))
           AND EXISTS(SELECT 1 FROM appartenance_espace ae WHERE ae.utilisateur_id=c.participant_b_id AND ae.espace_id=g.espace_id
             AND ae.statut='ACTIF' AND (ae.role='ADMINISTRATEUR' OR EXISTS(SELECT 1 FROM appartenance_groupe ag
               WHERE ag.utilisateur_id=ae.utilisateur_id AND ag.groupe_id=g.id AND ag.statut='ACTIF')))) AS can_send
        FROM conversation_privee c
        JOIN utilisateur ua ON ua.id=c.participant_a_id JOIN utilisateur ub ON ub.id=c.participant_b_id
        LEFT JOIN groupe g ON g.id=c.groupe_id LEFT JOIN espace_organisateur e ON e.id=g.espace_id
        """;

    private Conversation conversation(long id, long actor) {
        return jdbc.query(SUMMARY + " WHERE c.id=? AND (c.participant_a_id=? OR c.participant_b_id=?)",
            this::summary, actor, actor, actor, actor, actor, id, actor, actor).stream().findFirst().orElseThrow(this::missing);
    }

    @GetMapping("/conversations")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Conversation>> conversations(Authentication auth) {
        long actor = user(auth);
        var items = jdbc.query(SUMMARY + " WHERE c.participant_a_id=? OR c.participant_b_id=? ORDER BY COALESCE((SELECT max(m.id) FROM message_prive m WHERE m.conversation_id=c.id),0) DESC,c.id DESC LIMIT 100",
            this::summary, actor, actor, actor, actor, actor, actor, actor);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(items);
    }

    @GetMapping("/conversations/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Conversation> conversation(@PathVariable long id, Authentication auth) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(conversation(id, user(auth)));
    }

    @GetMapping("/groups/{groupId}/members")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Member>> members(@PathVariable long groupId, Authentication auth) {
        long actor = user(auth);
        if (!groupMember(actor, groupId, false)) throw missing();
        var items = jdbc.query("""
            SELECT u.id,concat_ws(' ',u.prenom,u.nom) AS name FROM utilisateur u
            WHERE u.statut='ACTIF' AND u.id<>? AND EXISTS(
              SELECT 1 FROM groupe g JOIN espace_organisateur e ON e.id=g.espace_id
              JOIN appartenance_espace ae ON ae.espace_id=g.espace_id AND ae.utilisateur_id=u.id AND ae.statut='ACTIF'
              WHERE g.id=? AND g.statut='ACTIF' AND e.statut='ACTIF'
                AND (ae.role='ADMINISTRATEUR' OR EXISTS(SELECT 1 FROM appartenance_groupe ag
                  WHERE ag.utilisateur_id=u.id AND ag.groupe_id=g.id AND ag.statut='ACTIF')))
              AND NOT EXISTS(SELECT 1 FROM blocage_message_prive b WHERE
                (b.bloqueur_id=? AND b.bloque_id=u.id) OR (b.bloqueur_id=u.id AND b.bloque_id=?))
            ORDER BY u.prenom,u.nom,u.id LIMIT 100
            """, (row, index) -> new Member(row.getLong("id"), row.getString("name")), actor, groupId, actor, actor);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(items);
    }

    @PostMapping("/conversations")
    @Transactional
    public ResponseEntity<Conversation> start(@Valid @RequestBody Start body, Authentication auth) {
        long actor = user(auth);
        long recipient = body.recipientId();
        if (actor == recipient) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez un autre membre.");
        if (jdbc.query("SELECT id FROM utilisateur WHERE id=? AND statut='ACTIF' FOR SHARE", (row, index) -> row.getLong(1), recipient).isEmpty()) throw missing();
        sharedGroup(body.groupId(), actor, recipient, true);
        allowMessages(actor, recipient);
        long first = Math.min(actor, recipient), second = Math.max(actor, recipient);
        long id = jdbc.queryForObject("""
            INSERT INTO conversation_privee(groupe_id,participant_a_id,participant_b_id) VALUES (?,?,?)
            ON CONFLICT (groupe_id,participant_a_id,participant_b_id) DO UPDATE SET groupe_id=excluded.groupe_id RETURNING id
            """, Long.class, body.groupId(), first, second);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(conversation(id, actor));
    }

    private Message mapMessage(java.sql.ResultSet row, int index) throws java.sql.SQLException {
        return new Message(row.getLong("id"), row.getString("contenu"), row.getObject("date_creation", OffsetDateTime.class),
            row.getObject("date_lecture", OffsetDateTime.class), row.getBoolean("mine"));
    }

    @GetMapping("/conversations/{id}/items")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Message>> messages(@PathVariable long id, @RequestParam(required = false) Long before, Authentication auth) {
        long actor = user(auth);
        pair(id, actor);
        var items = jdbc.query("""
            SELECT m.id,m.contenu,m.date_creation,m.date_lecture,m.expediteur_id=? AS mine
            FROM message_prive m WHERE m.conversation_id=? AND (CAST(? AS BIGINT) IS NULL OR m.id<?)
            ORDER BY m.id DESC LIMIT 30
            """, this::mapMessage, actor, id, before, before);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(items);
    }

    @PostMapping("/conversations/{id}/items")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Message send(@PathVariable long id, @Valid @RequestBody Send body, Authentication auth) {
        long actor = user(auth);
        Pair pair = pair(id, actor);
        if (pair.group() == 0) throw missing();
        if (jdbc.query("SELECT id FROM utilisateur WHERE id=? AND statut='ACTIF' FOR SHARE", (row, index) -> row.getLong(1), pair.other()).isEmpty()) throw missing();
        sharedGroup(pair.group(), actor, pair.other(), true);
        allowMessages(actor, pair.other());
        String content = body.content().strip();
        if (content.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le message est vide.");
        var previous = jdbc.queryForList("SELECT id,conversation_id,contenu FROM message_prive WHERE expediteur_id=? AND demande=?", actor, body.requestId());
        if (!previous.isEmpty()) {
            var old = previous.getFirst();
            if (((Number) old.get("conversation_id")).longValue() != id || !content.equals(old.get("contenu")))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette demande a déjà été utilisée.");
            return jdbc.queryForObject("SELECT id,contenu,date_creation,date_lecture,expediteur_id=? AS mine FROM message_prive WHERE id=?",
                this::mapMessage, actor, old.get("id"));
        }
        long recent = jdbc.queryForObject("SELECT count(*) FROM message_prive WHERE expediteur_id=? AND date_creation>now()-interval '1 minute'", Long.class, actor);
        if (recent >= 20) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Attendez avant d’envoyer d’autres messages.");
        long messageId = jdbc.queryForObject("INSERT INTO message_prive(conversation_id,expediteur_id,contenu,demande) VALUES (?,?,?,?) RETURNING id",
            Long.class, id, actor, content, body.requestId());
        return jdbc.queryForObject("SELECT id,contenu,date_creation,date_lecture,expediteur_id=? AS mine FROM message_prive WHERE id=?",
            this::mapMessage, actor, messageId);
    }

    @PostMapping("/conversations/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void read(@PathVariable long id, Authentication auth) {
        long actor = user(auth);
        pair(id, actor);
        jdbc.update("UPDATE message_prive SET date_lecture=now() WHERE conversation_id=? AND expediteur_id<>? AND date_lecture IS NULL", id, actor);
    }

    private void knownContact(long actor, long other) {
        if (actor == other || !Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM conversation_privee WHERE
              (participant_a_id=? AND participant_b_id=?) OR (participant_a_id=? AND participant_b_id=?))
            """, Boolean.class, actor, other, other, actor))) throw missing();
    }

    @PutMapping("/blocks/{otherId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void block(@PathVariable long otherId, Authentication auth) {
        long actor = user(auth);
        knownContact(actor, otherId);
        jdbc.update("INSERT INTO blocage_message_prive(bloqueur_id,bloque_id) VALUES (?,?) ON CONFLICT DO NOTHING", actor, otherId);
    }

    @DeleteMapping("/blocks/{otherId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void unblock(@PathVariable long otherId, Authentication auth) {
        long actor = user(auth);
        knownContact(actor, otherId);
        jdbc.update("DELETE FROM blocage_message_prive WHERE bloqueur_id=? AND bloque_id=?", actor, otherId);
    }

    @PostMapping("/items/{messageId}/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void report(@PathVariable long messageId, @Valid @RequestBody Report body, Authentication auth) {
        long actor = user(auth);
        var rows = jdbc.query("""
            SELECT m.expediteur_id FROM message_prive m JOIN conversation_privee c ON c.id=m.conversation_id
            WHERE m.id=? AND (c.participant_a_id=? OR c.participant_b_id=?)
            """, (row, index) -> row.getLong(1), messageId, actor, actor);
        if (rows.isEmpty() || rows.getFirst() == actor) throw missing();
        String reason = body.reason().strip();
        if (reason.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indiquez un motif.");
        jdbc.update("INSERT INTO signalement_message_prive(message_id,auteur_id,motif) VALUES (?,?,?) ON CONFLICT (message_id,auteur_id) DO NOTHING",
            messageId, actor, reason);
    }
}
