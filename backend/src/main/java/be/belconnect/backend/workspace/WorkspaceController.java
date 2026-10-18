package be.belconnect.backend.workspace;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace")
public class WorkspaceController {
    private final JdbcTemplate jdbc;
    public WorkspaceController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Space(long id, String name, String role) {}
    public record Group(long id, long spaceId, String name, String role, boolean canManageMemberships) {}
    public record Project(long id, String title, String status, String spaceName, String reviewStage) {}
    public record Overview(boolean owner, List<Space> spaces, List<Group> groups,
                           List<Project> projects, List<Space> managedSpaces) {}

    @GetMapping @Transactional(readOnly = true)
    public Overview overview(Authentication auth) {
        long userId = jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",
            (r,n) -> r.getLong(1), auth.getName()).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter."));
        boolean owner = Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')", Boolean.class, userId));
        var spaces = jdbc.query("""
            SELECT e.id, e.nom, a.role FROM appartenance_espace a
            JOIN espace_organisateur e ON e.id=a.espace_id
            WHERE a.utilisateur_id=? AND a.statut='ACTIF' AND e.statut='ACTIF'
            ORDER BY e.nom, e.id
            """, (r,n) -> new Space(r.getLong("id"), r.getString("nom"), r.getString("role")), userId);
        var groups = jdbc.query("""
            SELECT g.id, g.espace_id, g.nom,
              COALESCE(ag.role,'ADMINISTRATEUR') AS role,
              (a.role='ADMINISTRATEUR' OR (ag.role='REFERENT' AND g.referents_gerent_adhesions)) AS gestion_adhesions
            FROM appartenance_espace a
            JOIN espace_organisateur e ON e.id=a.espace_id
            JOIN groupe g ON g.espace_id=e.id
            LEFT JOIN appartenance_groupe ag ON ag.groupe_id=g.id AND ag.espace_id=g.espace_id
              AND ag.utilisateur_id=a.utilisateur_id AND ag.statut='ACTIF'
            WHERE a.utilisateur_id=? AND a.statut='ACTIF' AND e.statut='ACTIF' AND g.statut='ACTIF'
              AND (a.role='ADMINISTRATEUR' OR ag.utilisateur_id IS NOT NULL)
            ORDER BY g.nom, g.id
            """, (r,n) -> new Group(r.getLong("id"), r.getLong("espace_id"), r.getString("nom"), r.getString("role"),r.getBoolean("gestion_adhesions")), userId);
        // Personal drafts stay private, including from administrators and the platform owner.
        var projects = jdbc.query("""
            SELECT p.id, p.titre, p.statut, p.etape_validation, e.nom FROM projet p
            JOIN espace_organisateur e ON e.id=p.espace_id
            WHERE p.auteur_id=? ORDER BY p.date_modification DESC, p.id DESC
            """, (r,n) -> new Project(r.getLong("id"), r.getString("titre"), r.getString("statut"), r.getString("nom"), r.getString("etape_validation")), userId);
        List<Space> managedSpaces = owner ? jdbc.query(
            "SELECT id, nom FROM espace_organisateur WHERE statut='ACTIF' ORDER BY nom, id",
            (r,n) -> new Space(r.getLong("id"), r.getString("nom"), "PROPRIETAIRE")) : List.of();
        return new Overview(owner, spaces, groups, projects, managedSpaces);
    }
}
