package com.collaborative_code_editor.repository;

import com.collaborative_code_editor.model.ExecutionLog;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ExecutionLogRepository extends MongoRepository<ExecutionLog, String> {
}
