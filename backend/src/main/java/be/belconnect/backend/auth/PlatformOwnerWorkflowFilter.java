package be.belconnect.backend.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** A platform owner supervises Belconnect and cannot act as a participant or local organiser. */
final class PlatformOwnerWorkflowFilter extends OncePerRequestFilter {
    private final JdbcTemplate jdbc;

    PlatformOwnerWorkflowFilter(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        var method = request.getMethod();
        var path = request.getServletPath();
        boolean write = !method.equals("GET") && !method.equals("HEAD") && !method.equals("OPTIONS");
        if (!write || !path.startsWith("/api/") || path.startsWith("/api/auth/")) {
            chain.doFilter(request, response);
            return;
        }
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            chain.doFilter(request, response);
            return;
        }
        boolean owner = Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM role_plateforme r
              JOIN utilisateur u ON u.id=r.utilisateur_id
              WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE')
            """, Boolean.class, authentication.getName()));
        boolean ownerAction = method.equals("POST") && (path.matches("/api/workspace/opening-requests/[0-9]+/decision")
                || path.matches("/api/workspace/notifications/[0-9]+/read")
                || path.matches("/api/workspace/spaces/[0-9]+/administrators")
                || path.matches("/api/workspace/spaces/[0-9]+/administrators/recovery")
                || path.matches("/api/workspace/spaces/[0-9]+/administrators/[0-9]+/status")
                || path.matches("/api/workspace/owner/moderation/.*"));
        if (owner && !ownerAction) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN,
                "Le compte propriétaire est réservé à la supervision de Belconnect.");
            return;
        }
        chain.doFilter(request, response);
    }
}
