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
    public record Group(long id, long spaceId, String name, String role, boolean canManageMemberships, boolean canManageActivities) {}
    public record Project(long id, String title, String status, String spaceName, String reviewStage) {}
    public record SuspendedSpace(long id,String name,String reason) {}
    public record ModerationNotice(String spaceName,String action,String contentName,String reason) {}
    public record Overview(boolean owner, List<Space> spaces, List<Group> groups,
                           List<Project> projects, List<Space> managedSpaces,List<SuspendedSpace> suspendedSpaces,
                           List<ModerationNotice> moderationNotices) {}
    public record OwnerFinance(long activeSpaces, long proSpaces, long paidTransactions,
                               long confirmedCommissionCents, long pendingRefunds) {}
    public record OwnerActivitySummary(long upcomingActivities,long availablePlaces,long paidTickets) {}

    @GetMapping("/owner/activities-summary") @Transactional(readOnly = true)
    public OwnerActivitySummary ownerActivitySummary(Authentication auth) {
        long userId = jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",
            (r,n) -> r.getLong(1), auth.getName()).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter."));
        if (!Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",
            Boolean.class, userId)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cette vue est réservée au propriétaire de Belconnect.");
        return jdbc.queryForObject("""
            SELECT
              count(*) AS upcoming,
              COALESCE(sum(a.places_disponibles),0) AS available,
              COALESCE(sum((SELECT COALESCE(sum(r.quantite),0) FROM reservation_payante_activite r
                WHERE r.activite_id=a.id AND r.statut='PAYE')),0) AS tickets
            FROM activite a JOIN espace_organisateur e ON e.id=a.espace_id
              JOIN utilisateur u ON u.id=e.createur_id
            WHERE e.statut='ACTIF' AND a.publiee AND NOT a.annulee AND a.debut>now()
              AND u.email<>'belconnect-demo-projects@example.invalid'
            """,(r,n)->new OwnerActivitySummary(r.getLong("upcoming"),r.getLong("available"),r.getLong("tickets")));
    }

    @GetMapping("/owner/access") @Transactional(readOnly = true)
    public boolean ownerAccess(Authentication auth) {
        long userId = jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",
            (r,n) -> r.getLong(1), auth.getName()).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter."));
        return Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",
            Boolean.class, userId));
    }

    @GetMapping("/owner/finance") @Transactional(readOnly = true)
    public OwnerFinance ownerFinance(Authentication auth) {
        long userId = jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",
            (r,n) -> r.getLong(1), auth.getName()).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter."));
        if (!Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')",
            Boolean.class, userId)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cette vue est réservée au propriétaire de Belconnect.");
        return jdbc.queryForObject("""
            SELECT
              (SELECT count(*) FROM espace_organisateur e JOIN utilisateur u ON u.id=e.createur_id
                 WHERE e.statut='ACTIF' AND u.email<>'belconnect-demo-projects@example.invalid') AS active_spaces,
              (SELECT count(*) FROM abonnement_espace a JOIN espace_organisateur e ON e.id=a.espace_id
                 JOIN utilisateur u ON u.id=e.createur_id
                 WHERE e.statut='ACTIF' AND u.email<>'belconnect-demo-projects@example.invalid'
                   AND a.formule='PRO' AND a.statut='ACTIF') AS pro_spaces,
              (SELECT count(*) FROM (
                 SELECT r.id FROM reservation_payante_activite r
                   JOIN activite a ON a.id=r.activite_id JOIN espace_organisateur e ON e.id=a.espace_id
                   JOIN utilisateur u ON u.id=e.createur_id
                   WHERE r.statut='PAYE' AND u.email<>'belconnect-demo-projects@example.invalid'
                 UNION ALL SELECT i.id FROM inscription_payante_projet i
                   JOIN projet p ON p.id=i.projet_id JOIN espace_organisateur e ON e.id=p.espace_id
                   JOIN utilisateur u ON u.id=e.createur_id
                   WHERE i.statut='PAYE' AND u.email<>'belconnect-demo-projects@example.invalid'
                 UNION ALL SELECT d.id FROM don_projet d
                   JOIN projet p ON p.id=d.projet_id JOIN espace_organisateur e ON e.id=p.espace_id
                   JOIN utilisateur u ON u.id=e.createur_id
                   WHERE d.statut='PAYE' AND u.email<>'belconnect-demo-projects@example.invalid') paid) AS paid_transactions,
              (SELECT COALESCE(sum(commission_centimes),0) FROM (
                 SELECT r.commission_centimes FROM reservation_payante_activite r
                   JOIN activite a ON a.id=r.activite_id JOIN espace_organisateur e ON e.id=a.espace_id
                   JOIN utilisateur u ON u.id=e.createur_id
                   WHERE r.statut='PAYE' AND u.email<>'belconnect-demo-projects@example.invalid'
                 UNION ALL SELECT i.commission_centimes FROM inscription_payante_projet i
                   JOIN projet p ON p.id=i.projet_id JOIN espace_organisateur e ON e.id=p.espace_id
                   JOIN utilisateur u ON u.id=e.createur_id
                   WHERE i.statut='PAYE' AND u.email<>'belconnect-demo-projects@example.invalid'
                 UNION ALL SELECT d.commission_centimes FROM don_projet d
                   JOIN projet p ON p.id=d.projet_id JOIN espace_organisateur e ON e.id=p.espace_id
                   JOIN utilisateur u ON u.id=e.createur_id
                   WHERE d.statut='PAYE' AND u.email<>'belconnect-demo-projects@example.invalid') paid) AS confirmed_commission_cents,
              ((SELECT count(*) FROM reservation_payante_activite r
                   JOIN activite a ON a.id=r.activite_id JOIN espace_organisateur e ON e.id=a.espace_id
                   JOIN utilisateur u ON u.id=e.createur_id
                   WHERE r.statut='REMBOURSEMENT_EN_COURS' AND u.email<>'belconnect-demo-projects@example.invalid')
               +(SELECT count(*) FROM inscription_payante_projet i
                   JOIN projet p ON p.id=i.projet_id JOIN espace_organisateur e ON e.id=p.espace_id
                   JOIN utilisateur u ON u.id=e.createur_id
                   WHERE i.statut='REMBOURSEMENT_EN_COURS' AND u.email<>'belconnect-demo-projects@example.invalid')) AS pending_refunds
            """, (r,n) -> new OwnerFinance(r.getLong("active_spaces"), r.getLong("pro_spaces"),
                r.getLong("paid_transactions"), r.getLong("confirmed_commission_cents"),
                r.getLong("pending_refunds")));
    }

    public record SpaceNumbers(long spaceId,long groups,long members,long departures,long pendingRequests,long activities,long projects) {}
    @GetMapping("/space-numbers") @Transactional(readOnly = true)
    public List<SpaceNumbers> spaceNumbers(Authentication auth) {
        if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return jdbc.query("""
            SELECT e.id,
              (SELECT count(*) FROM groupe g WHERE g.espace_id=e.id AND g.statut='ACTIF') AS groups,
              (SELECT count(DISTINCT ag.utilisateur_id) FROM appartenance_groupe ag JOIN utilisateur member ON member.id=ag.utilisateur_id WHERE ag.espace_id=e.id AND ag.statut='ACTIF' AND member.statut='ACTIF') AS members,
              (SELECT count(DISTINCT ag.utilisateur_id) FROM appartenance_groupe ag WHERE ag.espace_id=e.id AND ag.date_depart_volontaire IS NOT NULL) AS departures,
              (SELECT count(*) FROM demande_adhesion_groupe d WHERE d.espace_id=e.id AND d.statut='EN_ATTENTE') AS pending_requests,
              (SELECT count(*) FROM activite ac WHERE ac.espace_id=e.id) AS activities,
              (SELECT count(*) FROM projet p WHERE p.espace_id=e.id) AS projects
            FROM appartenance_espace a JOIN espace_organisateur e ON e.id=a.espace_id
            JOIN utilisateur u ON u.id=a.utilisateur_id
            WHERE u.email=? AND u.statut='ACTIF' AND a.role='ADMINISTRATEUR'
              AND a.statut='ACTIF' AND e.statut='ACTIF'
            ORDER BY e.nom,e.id
            """,(r,n)->new SpaceNumbers(r.getLong("id"),r.getLong("groups"),r.getLong("members"),r.getLong("departures"),r.getLong("pending_requests"),r.getLong("activities"),r.getLong("projects")),auth.getName());
    }

    @GetMapping @Transactional(readOnly = true)
    public Overview overview(Authentication auth) {
        long userId = jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",
            (r,n) -> r.getLong(1), auth.getName()).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Veuillez vous reconnecter."));
        boolean owner = Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM role_plateforme WHERE utilisateur_id=? AND role='PROPRIETAIRE')", Boolean.class, userId));
        List<Space> spaces = owner ? List.of() : jdbc.query("""
            SELECT e.id, e.nom, a.role FROM appartenance_espace a
            JOIN espace_organisateur e ON e.id=a.espace_id
            WHERE a.utilisateur_id=? AND a.statut='ACTIF' AND e.statut='ACTIF'
            ORDER BY e.nom, e.id
            """, (r,n) -> new Space(r.getLong("id"), r.getString("nom"), r.getString("role")), userId);
        List<Group> groups = owner ? List.of() : jdbc.query("""
            SELECT g.id, g.espace_id, g.nom,
              CASE WHEN a.role='ADMINISTRATEUR' THEN 'GESTION_ESPACE' ELSE ag.role END AS role,
              (a.role='ADMINISTRATEUR' OR (ag.role='REFERENT' AND g.referents_gerent_adhesions)) AS gestion_adhesions,
              (a.role='ADMINISTRATEUR' OR (ag.role='REFERENT' AND g.referents_gerent_activites)) AS gestion_activites
            FROM appartenance_espace a
            JOIN espace_organisateur e ON e.id=a.espace_id
            JOIN groupe g ON g.espace_id=e.id
            LEFT JOIN appartenance_groupe ag ON ag.groupe_id=g.id AND ag.espace_id=g.espace_id
              AND ag.utilisateur_id=a.utilisateur_id AND ag.statut='ACTIF'
            WHERE a.utilisateur_id=? AND a.statut='ACTIF' AND e.statut='ACTIF' AND g.statut='ACTIF'
              AND (a.role='ADMINISTRATEUR' OR ag.utilisateur_id IS NOT NULL)
            ORDER BY g.nom, g.id
            """, (r,n) -> new Group(r.getLong("id"), r.getLong("espace_id"), r.getString("nom"), r.getString("role"),r.getBoolean("gestion_adhesions"),r.getBoolean("gestion_activites")), userId);
        // Personal drafts stay private, including from administrators and the platform owner.
        List<Project> projects = owner ? List.of() : jdbc.query("""
            SELECT p.id, p.titre, CASE WHEN p.termine_le IS NOT NULL THEN 'TERMINE' ELSE p.statut END AS statut, p.etape_validation, e.nom FROM projet p
            JOIN espace_organisateur e ON e.id=p.espace_id
            WHERE p.auteur_id=? ORDER BY p.date_modification DESC, p.id DESC
            """, (r,n) -> new Project(r.getLong("id"), r.getString("titre"), r.getString("statut"), r.getString("nom"), r.getString("etape_validation")), userId);
        List<Space> managedSpaces = owner ? jdbc.query("""
            SELECT e.id, e.nom, u.email FROM espace_organisateur e
            JOIN utilisateur u ON u.id=e.createur_id
            WHERE e.statut='ACTIF' ORDER BY e.nom, e.id
            """, (r,n) -> new Space(r.getLong("id"), r.getString("nom"),
                "belconnect-demo-projects@example.invalid".equals(r.getString("email")) ? "DEMO" : "PROPRIETAIRE")) : List.of();
        List<SuspendedSpace> suspendedSpaces = owner ? List.of() : jdbc.query("""
            SELECT e.id,e.nom,COALESCE((SELECT m.motif FROM moderation_plateforme m
              WHERE m.espace_id=e.id AND m.action='SUSPENDRE_ESPACE' ORDER BY m.id DESC LIMIT 1),'') AS motif
            FROM espace_organisateur e JOIN appartenance_espace a ON a.espace_id=e.id
            WHERE a.utilisateur_id=? AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF' AND e.statut='SUSPENDU'
            ORDER BY e.nom,e.id
            """,(r,n)->new SuspendedSpace(r.getLong("id"),r.getString("nom"),r.getString("motif")),userId);
        List<ModerationNotice> moderationNotices = owner ? List.of() : jdbc.query("""
            SELECT e.nom AS espace_nom,m.action,COALESCE(ac.titre,p.titre,'') AS contenu,m.motif
            FROM moderation_plateforme m JOIN espace_organisateur e ON e.id=m.espace_id
            LEFT JOIN activite ac ON ac.id=m.activite_id LEFT JOIN projet p ON p.id=m.projet_id
            WHERE m.action='MASQUER' AND EXISTS (
              SELECT 1 FROM appartenance_espace a WHERE a.espace_id=m.espace_id AND a.utilisateur_id=?
              AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF')
              AND NOT EXISTS (SELECT 1 FROM moderation_plateforme newer WHERE newer.id>m.id
                AND newer.action='RETABLIR' AND (newer.activite_id=m.activite_id OR newer.projet_id=m.projet_id))
            ORDER BY m.id DESC LIMIT 20
            """,(r,n)->new ModerationNotice(r.getString("espace_nom"),r.getString("action"),r.getString("contenu"),r.getString("motif")),userId);
        return new Overview(owner, spaces, groups, projects, managedSpaces,suspendedSpaces,moderationNotices);
    }
}
