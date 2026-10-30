package be.belconnect.backend.activity;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api/activities/{slug}/like")
public class ActivityLikeController {
    private final JdbcTemplate jdbc;
    private final ActivityAccess access;
    private final ActivityRepository activities;

    public ActivityLikeController(JdbcTemplate jdbc, ActivityAccess access, ActivityRepository activities) {
        this.jdbc = jdbc;
        this.access = access;
        this.activities = activities;
    }

    public record LikeState(long likeCount, boolean likedByMe) {}

    @PutMapping
    @Transactional
    public ResponseEntity<LikeState> like(@PathVariable String slug, Authentication auth) {
        return change(slug, auth, true);
    }

    @DeleteMapping
    @Transactional
    public ResponseEntity<LikeState> unlike(@PathVariable String slug, Authentication auth) {
        return change(slug, auth, false);
    }

    private ResponseEntity<LikeState> change(String slug, Authentication auth, boolean liked) {
        Long user = auth == null ? null : activities.userId(auth.getName());
        if (user == null) throw new ResponseStatusException(UNAUTHORIZED, "Veuillez vous connecter.");
        Long id = jdbc.query("SELECT id FROM activite WHERE slug=?", (row, index) -> row.getLong(1), slug)
            .stream().findFirst().orElse(null);
        if (id == null) throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Activité indisponible.");
        access.lockAndCheck(id, user);
        if (liked) {
            jdbc.update("INSERT INTO like_activite(activite_id,utilisateur_id) VALUES (?,?) ON CONFLICT DO NOTHING", id, user);
        } else {
            jdbc.update("DELETE FROM like_activite WHERE activite_id=? AND utilisateur_id=?", id, user);
        }
        long count = jdbc.queryForObject("SELECT count(*) FROM like_activite WHERE activite_id=?", Long.class, id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new LikeState(count, liked));
    }
}
