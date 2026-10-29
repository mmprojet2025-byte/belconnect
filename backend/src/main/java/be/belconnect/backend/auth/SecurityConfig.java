package be.belconnect.backend.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class SecurityConfig {
    @Bean org.springframework.security.core.userdetails.UserDetailsService userDetailsService(AccountRepository accounts) {
        return email -> {
            var account = accounts.findByEmail(email).orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("Compte introuvable"));
            return org.springframework.security.core.userdetails.User.withUsername(account.profile().email())
                .password(account.passwordHash()).roles("USER").disabled(!"ACTIF".equals(account.status())).build();
        };
    }
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean HttpSessionSecurityContextRepository securityContextRepository() { return new HttpSessionSecurityContextRepository(); }
    @Bean SecurityFilterChain securityFilterChain(HttpSecurity http, HttpSessionSecurityContextRepository repository, AccountRepository accounts, MobileTokenService mobileTokens, JdbcTemplate jdbc) throws Exception {
        return http
            .securityContext(context -> context.securityContextRepository(repository))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/groups", "/api/projects", "/api/projects/*", "/api/project-paid-participations/offer/*", "/api/activities", "/api/activities/*", "/api/auth/csrf", "/actuator/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login", "/api/auth/password/recovery", "/api/auth/password/reset").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/mobile/auth/register", "/api/mobile/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/stripe/webhook", "/api/stripe/subscriptions/webhook").permitAll()
                .requestMatchers("/error").permitAll()
                .anyRequest().authenticated())
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/stripe/webhook", "/api/stripe/subscriptions/webhook", "/api/mobile/auth/register", "/api/mobile/auth/login")
                .ignoringRequestMatchers(request -> { var value=request.getHeader("Authorization"); return value!=null && value.startsWith("Bearer "); }))
            .requestCache(AbstractHttpConfigurer::disable)
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) -> response.sendError(401))
                .accessDeniedHandler((request, response, exception) -> response.sendError(403)))
            .logout(logout -> logout.logoutUrl("/api/auth/logout").invalidateHttpSession(true)
                .clearAuthentication(true).deleteCookies("JSESSIONID")
                .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
            .addFilterAfter(new CredentialSessionFilter(accounts), SecurityContextHolderFilter.class)
            .addFilterAfter(new MobileBearerFilter(mobileTokens), CredentialSessionFilter.class)
            .addFilterAfter(new PlatformOwnerWorkflowFilter(jdbc), MobileBearerFilter.class)
            .build(); // Default CSRF protection remains enabled, including login and registration.
    }
}
