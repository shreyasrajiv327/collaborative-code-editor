package com.collaborative_code_editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document("execution_logs")
public class ExecutionLog {
    @Id
    private String id;

    private String projectId;
    private String executedBy; // GitHub ID or internal user ID
    private String filePath;   // Optional: path of the file

    private String sourceCode;
    private int languageId;

    private String stdout;
    private String stderr;
    private int exitCode;

    private String status;     // e.g., "Accepted", "Error"
    private Instant createdAt;
    private Instant finishedAt;

    private double time;       // in seconds
    private int memory;        // in KB
}
