package be.belconnect.backend.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects sessions created before a password change or account suspension. */
final class CredentialSessionFilter extends OncePerRequestFilter {
    static final String SESSION_HASH = "belconnect.passwordHash";
    private final AccountRepository accounts;
    CredentialSessionFilter(AccountRepository accounts) { this.accounts = accounts; }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
            var session = request.getSession(false);
            var account = accounts.findByEmail(authentication.getName()).orElse(null);
            if (session == null || account == null || !"ACTIF".equals(account.status())
                    || !account.passwordHash().equals(session.getAttribute(SESSION_HASH))) {
                if (session != null) session.invalidate();
                SecurityContextHolder.clearContext();
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
        }
        chain.doFilter(request,response);
    }
}
