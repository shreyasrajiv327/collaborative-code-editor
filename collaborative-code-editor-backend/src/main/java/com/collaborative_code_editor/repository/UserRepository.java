package com.collaborative_code_editor.repository;

import com.collaborative_code_editor.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    boolean existsByGithubId(String githubId);
    boolean existsByGithubLogin(String githubLogin);

    // Add this method
    Optional<User> findByGithubLogin(String githubLogin);
}
