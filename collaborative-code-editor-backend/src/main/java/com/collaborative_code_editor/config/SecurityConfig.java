package com.collaborative_code_editor.config;

import com.collaborative_code_editor.service.AuthService;
//import com.collaborative_code_editor.service.GithubService;
//import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.Map;
import java.util.TimeZone;
import java.util.*;
@Configuration
public class SecurityConfig {

    private final OAuth2AuthorizedClientService authorizedClientService;
//    private final ApplicationContext context;
    private final AuthService authService;
//    private final GithubService githubService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter; // Add the JwtAuthenticationFilter

    public SecurityConfig(OAuth2AuthorizedClientService authorizedClientService,
//                          ApplicationContext context,
                          AuthService authService,
//                          GithubService githubService,
                          JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.authorizedClientService = authorizedClientService;
//        this.context = context;
        this.authService = authService;
//        this.githubService = githubService;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter; // Inject the filter
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        final OAuth2AuthorizedClientService clientService = this.authorizedClientService;

        http

                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
//                .exceptionHandling(ex -> ex
//                        .authenticationEntryPoint((request, response, authException) -> {
//                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
//                            response.setContentType("application/json");
//                            response.getWriter().write("{\"error\":\"Unauthorized\"}");
//                        })
//                )
                .authorizeHttpRequests(auth -> auth
//                        .requestMatchers("/api/github/**").permitAll()
                        .requestMatchers("/oauth2/**", "/projects/**", "/ws/**", "/topic/**", "/api/execute").permitAll()
                        .anyRequest().authenticated()
                )

                .oauth2Login(oauth2 -> oauth2
                        .successHandler((request, response, authentication) -> {
                            OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;

                            // Get the OAuth2AuthorizedClient
                            OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                                    oauthToken.getAuthorizedClientRegistrationId(),
                                    oauthToken.getName());

                            String accessToken = client.getAccessToken().getTokenValue();
                            String refreshToken = client.getRefreshToken() != null
                                    ? client.getRefreshToken().getTokenValue()
                                    : null;

                            Instant accessTokenExpiryInstant = client.getAccessToken().getExpiresAt();
                            Date expiryDate = Date.from(accessTokenExpiryInstant);

                            // Format it to UTC string
                            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss z");
                            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));

                            System.out.println("Token expiration (UTC Date formatted): " + sdf.format(expiryDate));


//                            Date expiryDate = Date.from(client.getAccessToken().getExpiresAt()); // 💥 Fixed here

                            // Call your AuthService to handle login and return user details
                            Map<String, Object> userDetails = authService.handleLogin(oauthToken, accessToken, refreshToken, expiryDate);

                            // Log and redirect to frontend
                            System.out.println("USER DETAILS SENT TO FRONTEND: " + userDetails);
                            String frontendUrl = "http://localhost:5173/dashboard?" + buildQueryParams(userDetails);
                            System.out.println("Redirecting to frontend URL: " + frontendUrl);
                            response.sendRedirect(frontendUrl);
                        })
                )

//                .logout(logout -> logout
//                        .logoutUrl("/api/auth/logout") // Custom logout URL
//                        .logoutSuccessUrl("http://localhost:5173/") // Redirect after logout
//                        .invalidateHttpSession(true) // Invalidate session
//                        .deleteCookies("JSESSIONID") // Remove session cookie
//                )

                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);


        return http.build();
    }

    private String buildQueryParams(Map<String, Object> userDetails) {
        StringBuilder queryParams = new StringBuilder();

        userDetails.forEach((key, value) -> {
            if (value != null) {
                try {
                    queryParams.append(URLEncoder.encode(key, StandardCharsets.UTF_8.toString()))
                            .append("=")
                            .append(URLEncoder.encode(value.toString(), StandardCharsets.UTF_8.toString()))
                            .append("&");
                } catch (UnsupportedEncodingException e) {
                    e.printStackTrace();
                }
            }
        });

        // Remove the trailing "&" if any
        if (queryParams.length() > 0) {
            queryParams.deleteCharAt(queryParams.length() - 1);
        }

        return queryParams.toString();
    }
}
