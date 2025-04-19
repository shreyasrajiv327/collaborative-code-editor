package com.collaborative_code_editor.service;

import com.collaborative_code_editor.model.User;
import com.collaborative_code_editor.repository.UserRepository;
import com.collaborative_code_editor.service.RedisService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;

import javax.crypto.spec.SecretKeySpec;
import java.security.Key;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class AuthService {

    @Value("${jwt.secret}")
    private String SECRET_KEY;

    @Value("${spring.security.oauth2.client.registration.github.client-id}")
    private String githubClientId;

    @Value("${spring.security.oauth2.client.registration.github.client-secret}")
    private String githubClientSecret;

    @Autowired
    private RedisService redisService;

    @Autowired
    private UserRepository userRepository;

    public Map<String, Object> handleLogin(OAuth2AuthenticationToken authentication, String accessToken, String refreshToken, Date accessTokenExpiry) {
        var attributes = authentication.getPrincipal().getAttributes();
        String githubLogin = (String) attributes.get("login");
        String githubId = String.valueOf(attributes.get("id"));
        System.out.println("githubLogin:" + githubLogin);
        System.out.println("*****accessTokenExpiry*****:" + accessTokenExpiry);

        // Redis Session (Store user details in Redis for session management)
        Map<String, Object> userDetails = new HashMap<>();
        userDetails.put("githubLogin", githubLogin);
        userDetails.put("name", attributes.get("name"));
        userDetails.put("email", attributes.get("email"));
        userDetails.put("avatarUrl", attributes.get("avatar_url"));
        userDetails.put("githubId", attributes.get("id"));
        userDetails.put("githubUrl", attributes.get("url"));
        redisService.storeUserSession(githubLogin, userDetails, 1, TimeUnit.HOURS);

        // MongoDB Persistence (Check if the user already exists)
        if (!userRepository.existsByGithubLogin(githubLogin)) {
            User user = new User();
            user.setGithubLogin(githubLogin);
            user.setName((String) attributes.get("name"));
            user.setEmail((String) attributes.get("email"));
            user.setAvatarUrl((String) attributes.get("avatar_url"));
            user.setGithubId((Integer) attributes.get("id"));
            user.setGithubUrl((String) attributes.get("url"));
            userRepository.save(user);
        }

        // Create JWT Token for frontend-backend communication
        String jwtToken = generateJwtToken(githubLogin, accessToken, refreshToken, accessTokenExpiry);

        // Add the JWT token to the response
        userDetails.put("token", jwtToken);

        return userDetails;
    }

    private String generateJwtToken(String githubLogin, String accessToken, String refreshToken, Date accessTokenExpiry) {
        Key key = new SecretKeySpec(SECRET_KEY.getBytes(), SignatureAlgorithm.HS256.getJcaName());
        // Set your own expiry (e.g., 15 minutes from now)
        Instant jwtExpiryInstant = Instant.now().plus(60, ChronoUnit.MINUTES);
        Date jwtExpiryDate = Date.from(jwtExpiryInstant);
        return Jwts.builder()
                .setSubject(githubLogin)
                .setIssuedAt(new Date())
                .setExpiration(jwtExpiryDate)
                .claim("githubLogin", githubLogin)
                .claim("accessToken", accessToken)  // Store GitHub access token in the JWT
                .claim("refreshToken", refreshToken)  // Store GitHub refresh token in the JWT
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Map<String, Object> refreshGithubToken(String githubLogin, String refreshToken) {
        try {
            // Use GitHub's refresh endpoint
            var request = new org.springframework.http.HttpEntity<>(Map.of(
                    "client_id", githubClientId,
                    "client_secret", githubClientSecret,
                    "grant_type", "refresh_token",
                    "refresh_token", refreshToken
            ));

            var response = new org.springframework.web.client.RestTemplate().postForEntity(
                    "https://github.com/login/oauth/access_token", request, Map.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Refresh failed");
            }

            Map<String, Object> body = response.getBody();
            if (body == null || !body.containsKey("access_token")) {
                throw new RuntimeException("Invalid refresh response");
            }

            String newAccessToken = (String) body.get("access_token");
            String newRefreshToken = (String) body.getOrDefault("refresh_token", refreshToken); // fallback
            long expiresIn = ((Number) body.getOrDefault("expires_in", 3600)).longValue();

            Date newExpiry = new Date(System.currentTimeMillis() + expiresIn * 1000);
            String newJwt = generateJwtToken(githubLogin, newAccessToken, newRefreshToken, newExpiry);

            Map<String, Object> result = new HashMap<>();
            result.put("token", newJwt);
            return result;

        } catch (Exception e) {
        Map<String, Object> error = new HashMap<>();
        error.put("error", "Invalid or expired refresh token. Please log in again.");
        error.put("details", e.getMessage());
        return error;
    }
    }

}
