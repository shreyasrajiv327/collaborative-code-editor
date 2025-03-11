package com.collab.editor.collaborative_code_editor.service;

import okhttp3.*;
import org.springframework.stereotype.Service;
import org.json.JSONObject;
import java.io.IOException;

@Service
public class Judge0Client {

    private static final String JUDGE0_URL = "https://judge0-ce.p.rapidapi.com/submissions";
    private static final String JUDGE0_HOST = "judge0-ce.p.rapidapi.com";
    private static final String API_KEY = "cd702e026fmsh0e0e31055652f87p16bc5bjsn2cc13a110191";  // Replace with your Judge0 API Key
    private final OkHttpClient client = new OkHttpClient();

    private String fetchExecutionResult(String token) {
        String url = JUDGE0_URL + "/" + token + "?base64_encoded=true&fields=*";

        Request request = new Request.Builder()
                .url(url)
                .get()
                .addHeader("x-rapidapi-key", API_KEY)
                .addHeader("x-rapidapi-host", JUDGE0_HOST)
                .build();

        for (int i = 0; i < 5; i++) {
            try (Response response = client.newCall(request).execute()) {
                JSONObject jsonResponse = new JSONObject(response.body().string());
                String status = jsonResponse.getJSONObject("status").getString("description");

                if (status.equals("Completed")) {
                    return jsonResponse.toString();
                }

                Thread.sleep(1000);
            } catch (IOException | InterruptedException e) {
                return "Error fetching execution result";
            }
        }
        return "Execution timed out";
    }


    public String submitCode(String sourceCode, int languageId, String stdin) {
        MediaType mediaType = MediaType.parse("application/json");

        JSONObject jsonPayload = new JSONObject();
        jsonPayload.put("language_id", languageId);
        jsonPayload.put("source_code", sourceCode);
        jsonPayload.put("stdin", stdin);

        RequestBody body = RequestBody.create(jsonPayload.toString(), mediaType);

        Request request = new Request.Builder()
                .url(JUDGE0_URL + "?base64_encoded=true&wait=false&fields=*")
                .post(body)
                .addHeader("x-rapidapi-key", API_KEY)
                .addHeader("x-rapidapi-host", JUDGE0_HOST)
                .addHeader("Content-Type", "application/json")
                .build();

        System.out.print("I AM HEREEEEEEEEEEEEE ***********************************************");
        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                return "Error executing code: " + response.message();
            }

            JSONObject responseJson = new JSONObject(response.body().string());
            String token = responseJson.getString("token");

            return fetchExecutionResult(token);
        } catch (IOException e) {
            return "Error executing code";
        }
    }
}
