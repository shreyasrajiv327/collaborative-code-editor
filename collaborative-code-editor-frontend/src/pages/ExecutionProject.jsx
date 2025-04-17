import { useState } from "react";

const useExecuteCode = () => {
  const [executionResult, setExecutionResult] = useState(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionError, setExecutionError] = useState(null);

  const executeCode = async (filePath, fileContent, projectId, userId, judge0Language) => {
    if (!fileContent) {
      setExecutionError("No content to execute");
      return;
    }

    if (!judge0Language) {
      setExecutionError("Execution not supported for this file type");
      return;
    }

    const accessToken = localStorage.getItem("token");

    if (!accessToken) {
      alert("Access token missing. Please log in again.");
      return;
    }

    setExecutionLoading(true);
    setExecutionError(null);
    setExecutionResult(null);

    try {
      const executionRequest = {
        code: fileContent,
        language: judge0Language,
        projectId,
        executedBy: userId,
        filePath,
      };

      const response = await fetch("http://localhost:8080/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(executionRequest),
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        throw new Error("Received non-JSON response from server");
      }

      console.log("Raw backend response:", result); // Debug log

      if (!response.ok) {
        // If response isn't ok, but still has JSON body with `error` field
        const errorMsg = result.error || `Execution failed: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      if (result.error) {
        throw new Error(result.error);
      }

      setExecutionResult(result);

    } catch (err) {
      console.error("Error executing code:", err);
      setExecutionError(err.message);
    } finally {
      setExecutionLoading(false);
    }
  };

  return { executeCode, executionResult, executionLoading, executionError, setExecutionResult, setExecutionError };
};

export default useExecuteCode;
