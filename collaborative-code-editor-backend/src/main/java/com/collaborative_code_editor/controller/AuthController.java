package com.collaborative_code_editor.controller;

import com.collaborative_code_editor.service.AuthService;
import com.collaborative_code_editor.service.RedisService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Date;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final RedisService redisService;
    private final OAuth2AuthorizedClientService authorizedClientService;

    // Constructor injection of AuthService and OAuth2AuthorizedClientService
    @Autowired
    public AuthController(AuthService authService, RedisService redisService, OAuth2AuthorizedClientService authorizedClientService) {
        this.authService = authService;
        this.redisService = redisService;
        this.authorizedClientService = authorizedClientService;
    }

    // 👉 Called after successful OAuth2 login
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getUser(OAuth2AuthenticationToken authentication) {
        if (authentication == null) {
            System.out.println("Authentication token is null");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                authentication.getAuthorizedClientRegistrationId(),
                authentication.getName());

        String accessToken = client.getAccessToken().getTokenValue();
        String refreshToken = client.getRefreshToken() != null ? client.getRefreshToken().getTokenValue() : null;
        Date accessTokenExpiry = client.getAccessToken().getExpiresAt() != null ?
                Date.from(client.getAccessToken().getExpiresAt()) : new Date(System.currentTimeMillis() + 3600 * 1000); // Fallback

        Map<String, Object> userDetails = authService.handleLogin(authentication, accessToken, refreshToken, accessTokenExpiry);
        System.out.println("USER DETAILS SENT TO FRONTEND: " + userDetails);
        return ResponseEntity.ok(userDetails);
    }


    // NEW: Refresh token endpoint
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshAccessToken(@RequestBody Map<String, String> payload) {
        try {
            String githubLogin = payload.get("githubLogin");
            String refreshToken = payload.get("refreshToken");

            if (refreshToken == null || githubLogin == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "Missing required fields"
                ));
            }

            Map<String, Object> result = authService.refreshGithubToken(githubLogin, refreshToken);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "Refresh token invalid or expired. Please log in again."
            ));
        }
    }

    // 👉 Logout route (if you're using Spring Security session invalidation)
    @PostMapping("/logout")
    public RedirectView logout(HttpServletRequest request, HttpServletResponse response) {
        System.out.println("*********** LOGGING OUT ************");

        OAuth2AuthenticationToken authentication = (OAuth2AuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null) {
            String userId = authentication.getName(); // Extract user ID

            // Step 1: Remove user from all projects
            Set<Object> projectIds = redisService.getProjectUsers(userId);
            for (Object projectId : projectIds) {
                redisService.removeUserFromProject((String) projectId, userId);
            }


            // Step 2: Invalidate OAuth2 session
            OAuth2AuthorizedClient authorizedClient = authorizedClientService.loadAuthorizedClient(
                    authentication.getAuthorizedClientRegistrationId(), userId);
            if (authorizedClient != null) {
                authorizedClientService.removeAuthorizedClient(authentication.getAuthorizedClientRegistrationId(), userId);
                System.out.println("OAuth2 client session invalidated.");
            }

            // Perform Spring Security logout
            new SecurityContextLogoutHandler().logout(request, response, authentication);
        }

        System.out.println("*********** LOGGED OUT ************");

        // Redirect to the home page after logout
        return new RedirectView("http://localhost:5173/create");
    }
}