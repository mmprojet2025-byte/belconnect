package be.belconnect.backend;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ActivityCommentApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    final ObjectMapper json = new ObjectMapper();
    final HttpClient client = HttpClient.newHttpClient();

    HttpResponse<String> call(String method, String path, String token, Object body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).header("Accept", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    String register(String email) throws Exception {
        var result = call("POST", "/api/mobile/auth/register", null,
            Map.of("email", email, "password", "Comment-password-123", "firstName", "Nora", "lastName", "Mobile"));
        assertEquals(201, result.statusCode(), result.body());
        return json.readTree(result.body()).get("token").asText();
    }

    @Test void authorCanPublishOnceAndOnlyAuthorCanDelete() throws Exception {
        String marker = UUID.randomUUID().toString();
        String first = "comment-" + marker + "@example.com";
        String second = "comment-other-" + marker + "@example.com";
        String token = register(first);
        String other = register(second);
        String path = "/api/activities/chocolat/comments";
        try {
            assertEquals(200, call("GET", path, null, null).statusCode());
            assertEquals(401, call("POST", path, "invalid-token", Map.of("requestId", UUID.randomUUID(), "content", "Bonjour")).statusCode());
            var body = Map.of("requestId", UUID.randomUUID(), "content", "Bonjour le groupe !");
            var created = call("POST", path, token, body);
            assertEquals(201, created.statusCode(), created.body());
            long id = json.readTree(created.body()).get("id").asLong();
            assertTrue(json.readTree(created.body()).get("mine").asBoolean());
            assertEquals(id, json.readTree(call("POST", path, token, body).body()).get("id").asLong());
            assertEquals(409, call("POST", path, token, Map.of("requestId", body.get("requestId"), "content", "Autre texte")).statusCode());
            var listed = json.readTree(call("GET", path, other, null).body());
            assertTrue(listed.size() > 0);
            assertFalse(listed.get(0).get("mine").asBoolean());
            assertEquals(404, call("DELETE", path + "/" + id, other, null).statusCode());
            assertEquals(204, call("DELETE", path + "/" + id, token, null).statusCode());
            assertEquals(404, call("DELETE", path + "/" + id, token, null).statusCode());
            assertEquals(404, call("GET", "/api/activities/inconnue/comments", null, null).statusCode());
        } finally {
            jdbc.update("DELETE FROM commentaire_activite WHERE auteur_id IN (SELECT id FROM utilisateur WHERE email IN (?,?))", first, second);
            jdbc.update("DELETE FROM session_mobile WHERE utilisateur_id IN (SELECT id FROM utilisateur WHERE email IN (?,?))", first, second);
            jdbc.update("DELETE FROM utilisateur WHERE email IN (?,?)", first, second);
        }
    }
}
