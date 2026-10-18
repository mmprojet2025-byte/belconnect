package be.belconnect.backend.activity;

import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {
    private final ActivityRepository repository;
    public ActivityController(ActivityRepository repository) { this.repository = repository; }

    @GetMapping
    public ResponseEntity<List<ActivityView>> list(org.springframework.security.core.Authentication auth) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(repository.findPublished(auth==null?null:repository.userId(auth.getName())));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ActivityView> detail(@PathVariable String slug,org.springframework.security.core.Authentication auth) {
        var activity = repository.findPublishedBySlug(slug,auth==null?null:repository.userId(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Activité introuvable"));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(activity);
    }
}
