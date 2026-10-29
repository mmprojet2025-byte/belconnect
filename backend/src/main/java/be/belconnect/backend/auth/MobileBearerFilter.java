package be.belconnect.backend.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class MobileBearerFilter extends OncePerRequestFilter {
    private final MobileTokenService tokens;
    MobileBearerFilter(MobileTokenService tokens) { this.tokens = tokens; }

    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        String header=request.getHeader("Authorization");
        if(header!=null && header.startsWith("Bearer ")) {
            var profile=tokens.authenticate(header.substring(7));
            if(profile==null) { response.sendError(HttpServletResponse.SC_UNAUTHORIZED); return; }
            var authentication=UsernamePasswordAuthenticationToken.authenticated(profile.email(),null,AuthorityUtils.createAuthorityList("ROLE_USER"));
            authentication.setDetails(profile);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }
        chain.doFilter(request,response);
    }
}
