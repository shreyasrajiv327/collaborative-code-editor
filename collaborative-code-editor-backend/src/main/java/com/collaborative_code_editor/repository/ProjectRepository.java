package com.collaborative_code_editor.repository;

import com.collaborative_code_editor.model.Project;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends MongoRepository<Project, String> {
    List<Project> findByOwner(String owner);
    List<Project> findByCollaboratorsContaining(String githubId);

    Optional<Project> findByName(String name);
    boolean existsByNameAndOwner(String name, String owner);
}
