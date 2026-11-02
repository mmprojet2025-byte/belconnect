package be.belconnect.backend.auth;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.Set;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/** Applies to every owner API access, including old sessions and bearer tokens. */
final class OwnerMfaFilter extends OncePerRequestFilter {
    private final OwnerMfaService service;
    private final OwnerSessionService sessions;
    OwnerMfaFilter(OwnerMfaService service,OwnerSessionService sessions){this.service=service;this.sessions=sessions;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken) && request.getServletPath().startsWith("/api/")){
            Long id=service.ownerId(auth.getName());
            if(id!=null){
                response.setHeader("Cache-Control","no-store");
                // Owner administration is web-only until a mobile second-factor flow exists.
                if(request.getHeader("Authorization")!=null && request.getHeader("Authorization").startsWith("Bearer ")){deny(response,"Connectez le compte propriétaire sur le site web avec la double authentification.");return;}
                var session=request.getSession(false);
                if(session!=null)session.setMaxInactiveInterval(900);
                if(!sessions.touch(id,request)){
                    if(session!=null)session.invalidate();SecurityContextHolder.clearContext();response.sendError(401);return;
                }
                String path=request.getServletPath();
                boolean allowed=Set.of("/api/auth/me","/api/auth/csrf","/api/auth/logout","/api/auth/login").contains(path)||path.startsWith("/api/auth/owner-mfa/");
                if(!allowed&&!service.status(id,session).verified()){deny(response,"La double authentification du propriétaire est requise.");return;}
                boolean sensitive=request.getMethod().equals("POST") && (
                    path.matches("/api/workspace/opening-requests/[0-9]+/(decision|edit|reopen)") ||
                    path.matches("/api/workspace/spaces/[0-9]+/administrators.*") ||
                    path.startsWith("/api/workspace/owner/moderation/") ||
                    path.matches("/api/workspace/owner/pro-requests/[0-9]+/take") ||
                    path.matches("/api/auth/owner-mfa/sessions/.*"));
                if(sensitive && !service.recentlyVerified(id,session)){
                    response.setStatus(403);response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write("{\"message\":\"Confirmez votre code de sécurité puis relancez cette action.\",\"code\":\"OWNER_REVERIFY_REQUIRED\"}");return;
                }
            }
        }
        chain.doFilter(request,response);
    }
    private void deny(HttpServletResponse response,String text)throws IOException{response.setStatus(403);response.setContentType("application/json;charset=UTF-8");response.getWriter().write("{\"message\":\""+text+"\",\"code\":\"OWNER_MFA_REQUIRED\"}");}
}
