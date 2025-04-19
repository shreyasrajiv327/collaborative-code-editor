package com.collaborative_code_editor.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;


@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws") // frontend connects here
                .setAllowedOriginPatterns("*") // allow CORS (restrict this in production)
                .setAllowedOrigins("http://localhost:5173")
                .withSockJS(); // fallback for browsers that don’t support WebSockets
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic"); // where server sends messages
        registry.setApplicationDestinationPrefixes("/app"); // where client sends messages
    }
}

