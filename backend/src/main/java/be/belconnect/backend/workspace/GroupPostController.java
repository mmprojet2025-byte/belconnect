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
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/groups/{groupId}")
public class GroupPostController {
    private final JdbcTemplate jdbc;

    public GroupPostController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Creation(@NotNull UUID requestId, @NotBlank @Size(max = 1000) String content) {}
    public record Post(long id, String author, String content, OffsetDateTime createdAt, boolean mine) {}
    public record Announcement(long id, String author, String content, OffsetDateTime createdAt) {}

    private long user(Authentication auth) {
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous connecter.");
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'", (row, index) -> row.getLong(1), auth.getName())
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter."));
    }

    private boolean admin(long actor, long space) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM appartenance_espace
              WHERE utilisateur_id=? AND espace_id=? AND role='ADMINISTRATEUR' AND statut='ACTIF')
            """, Boolean.class, actor, space));
    }

    private long checkAccess(long group, long actor, boolean lock) {
        var rows = jdbc.query("""
            SELECT g.espace_id FROM groupe g JOIN espace_organisateur e ON e.id=g.espace_id
            WHERE g.id=? AND g.statut='ACTIF' AND e.statut='ACTIF'
            """ + (lock ? " FOR SHARE OF g,e" : ""), (row, index) -> row.getLong(1), group);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Groupe indisponible.");
        long space = rows.getFirst();
        boolean allowed = Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM appartenance_espace ae
              WHERE ae.utilisateur_id=? AND ae.espace_id=? AND ae.statut='ACTIF'
              AND (ae.role='ADMINISTRATEUR' OR EXISTS(
                SELECT 1 FROM appartenance_groupe ag WHERE ag.utilisateur_id=ae.utilisateur_id
                AND ag.espace_id=ae.espace_id AND ag.groupe_id=? AND ag.statut='ACTIF')))
            """, Boolean.class, actor, space, group));
        if (!allowed) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Groupe indisponible.");
        if (lock) {
            var roles = jdbc.query("SELECT role FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=? AND statut='ACTIF' FOR SHARE",
                (row, index) -> row.getString(1), actor, space);
            if (roles.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Groupe indisponible.");
            if (!roles.getFirst().equals("ADMINISTRATEUR") && jdbc.query("""
                SELECT groupe_id FROM appartenance_groupe
                WHERE utilisateur_id=? AND espace_id=? AND groupe_id=? AND statut='ACTIF' FOR SHARE
                """, (row, index) -> row.getLong(1), actor, space, group).isEmpty())
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Groupe indisponible.");
        }
        return space;
    }

    private Post map(java.sql.ResultSet row, int index) throws java.sql.SQLException {
        return new Post(row.getLong("id"), row.getString("prenom") + " " + row.getString("nom"),
            row.getString("contenu"), row.getObject("date_creation", OffsetDateTime.class), row.getBoolean("mine"));
    }

    private Post find(long id, long actor) {
        return jdbc.queryForObject("""
            SELECT p.id,p.contenu,p.date_creation,u.prenom,u.nom,p.auteur_id=? AS mine
            FROM publication_groupe_mobile p JOIN utilisateur u ON u.id=p.auteur_id WHERE p.id=?
            """, this::map, actor, id);
    }

    @GetMapping("/posts")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Post>> posts(@PathVariable long groupId, @RequestParam(required = false) Long before,
            Authentication auth) {
        long actor = user(auth);
        checkAccess(groupId, actor, false);
        var items = jdbc.query("""
            SELECT p.id,p.contenu,p.date_creation,u.prenom,u.nom,p.auteur_id=? AS mine
            FROM publication_groupe_mobile p JOIN utilisateur u ON u.id=p.auteur_id
            WHERE p.groupe_id=? AND (CAST(? AS BIGINT) IS NULL OR p.id<?)
            ORDER BY p.id DESC LIMIT 30
            """, this::map, actor, groupId, before, before);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(items);
    }

    @GetMapping("/announcements")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Announcement>> announcements(@PathVariable long groupId, Authentication auth) {
        long actor = user(auth);
        checkAccess(groupId, actor, false);
        var items = jdbc.query("""
            SELECT n.id,n.contenu,n.date_creation,u.prenom,u.nom
            FROM annonce_groupe n JOIN utilisateur u ON u.id=n.auteur_id
            WHERE n.groupe_id=? ORDER BY n.id DESC LIMIT 10
            """, (row, index) -> new Announcement(row.getLong("id"), row.getString("prenom") + " " + row.getString("nom"),
                row.getString("contenu"), row.getObject("date_creation", OffsetDateTime.class)), groupId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(items);
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Post create(@PathVariable long groupId, Authentication auth, @Valid @RequestBody Creation body) {
        long actor = user(auth);
        checkAccess(groupId, actor, true);
        String content = body.content().strip();
        if (content.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le message est vide.");
        var old = jdbc.queryForList("SELECT id,groupe_id,contenu FROM publication_groupe_mobile WHERE auteur_id=? AND demande=?", actor, body.requestId());
        if (!old.isEmpty()) {
            var previous = old.getFirst();
            if (((Number) previous.get("groupe_id")).longValue() != groupId || !content.equals(previous.get("contenu")))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette demande a déjà été utilisée.");
            return find(((Number) previous.get("id")).longValue(), actor);
        }
        long id = jdbc.queryForObject("INSERT INTO publication_groupe_mobile(groupe_id,auteur_id,contenu,demande) VALUES (?,?,?,?) RETURNING id",
            Long.class, groupId, actor, content, body.requestId());
        return find(id, actor);
    }

    @DeleteMapping("/posts/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable long groupId, @PathVariable long postId, Authentication auth) {
        long actor = user(auth);
        long space = checkAccess(groupId, actor, true);
        int changed = admin(actor, space)
            ? jdbc.update("DELETE FROM publication_groupe_mobile WHERE id=? AND groupe_id=?", postId, groupId)
            : jdbc.update("DELETE FROM publication_groupe_mobile WHERE id=? AND groupe_id=? AND auteur_id=?", postId, groupId, actor);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Publication introuvable.");
    }
}
