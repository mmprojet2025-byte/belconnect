package be.belconnect.backend.activity;

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
@RequestMapping("/api/activities/{slug}/comments")
public class ActivityCommentController {
    private final JdbcTemplate jdbc;
    private final ActivityAccess access;
    private final ActivityRepository activities;

    public ActivityCommentController(JdbcTemplate jdbc, ActivityAccess access, ActivityRepository activities) {
        this.jdbc = jdbc;
        this.access = access;
        this.activities = activities;
    }

    public record Creation(@NotNull UUID requestId, @NotBlank @Size(max = 500) String content) {}
    public record Comment(long id, String author, String content, OffsetDateTime createdAt, boolean mine) {}

    private Long user(Authentication auth) {
        return auth == null ? null : activities.userId(auth.getName());
    }

    private long activity(String slug, Long user) {
        return jdbc.query("SELECT a.id FROM activite a WHERE a.slug=? AND " + ActivityAccess.VISIBLE,
            (row, index) -> row.getLong(1), slug, user).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activité indisponible."));
    }

    private Comment map(java.sql.ResultSet row, int index) throws java.sql.SQLException {
        return new Comment(row.getLong("id"), row.getString("prenom") + " " + row.getString("nom"),
            row.getString("contenu"), row.getObject("date_creation", OffsetDateTime.class), row.getBoolean("mine"));
    }

    private Comment find(long id, long user) {
        return jdbc.queryForObject("""
            SELECT c.id,c.contenu,c.date_creation,u.prenom,u.nom,c.auteur_id=? AS mine
            FROM commentaire_activite c JOIN utilisateur u ON u.id=c.auteur_id WHERE c.id=?
            """, this::map, user, id);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Comment>> list(@PathVariable String slug, @RequestParam(required = false) Long before,
            Authentication auth) {
        Long viewer = user(auth);
        long id = activity(slug, viewer);
        var comments = jdbc.query("""
            SELECT c.id,c.contenu,c.date_creation,u.prenom,u.nom,c.auteur_id=? AS mine
            FROM commentaire_activite c JOIN utilisateur u ON u.id=c.auteur_id
            WHERE c.activite_id=? AND (CAST(? AS BIGINT) IS NULL OR c.id<?)
            ORDER BY c.id DESC LIMIT 30
            """, this::map, viewer, id, before, before);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(comments);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Comment create(@PathVariable String slug, Authentication auth, @Valid @RequestBody Creation body) {
        Long actor = user(auth);
        if (actor == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous connecter.");
        long id = activity(slug, actor);
        access.lockAndCheck(id, actor);
        String content = body.content().strip();
        if (content.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le commentaire est vide.");
        var previous = jdbc.queryForList("SELECT id,activite_id,contenu FROM commentaire_activite WHERE auteur_id=? AND demande=?", actor, body.requestId());
        if (!previous.isEmpty()) {
            var old = previous.getFirst();
            if (((Number) old.get("activite_id")).longValue() != id || !content.equals(old.get("contenu")))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette demande a déjà été utilisée.");
            return find(((Number) old.get("id")).longValue(), actor);
        }
        long commentId = jdbc.queryForObject("INSERT INTO commentaire_activite(activite_id,auteur_id,contenu,demande) VALUES (?,?,?,?) RETURNING id",
            Long.class, id, actor, content, body.requestId());
        return find(commentId, actor);
    }

    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable String slug, @PathVariable long commentId, Authentication auth) {
        Long actor = user(auth);
        if (actor == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous connecter.");
        long id = activity(slug, actor);
        access.lockAndCheck(id, actor);
        if (jdbc.update("DELETE FROM commentaire_activite WHERE id=? AND activite_id=? AND auteur_id=?", commentId, id, actor) == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Commentaire introuvable.");
    }
}
