import axios from 'axios';

export const executeCode = async (sourceCode, languageId, stdin) => {
    try {
        const response = await axios.post("http://localhost:8080/api/code", {
            sourceCode: sourceCode,
            languageId: languageId,
            stdin: stdin
        });

        return response.data;  // Return output from backend
    } catch (error) {
        console.error("🚨 Error executing code:", error.response?.data || error.message);
        return `Execution failed: ${error.response?.data?.message || "Unknown error"}`;
    }
};
