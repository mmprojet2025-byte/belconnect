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
class ActivityLikeApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    final ObjectMapper json = new ObjectMapper();
    final HttpClient client = HttpClient.newHttpClient();

    HttpResponse<String> call(String method, String path, String token, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).header("Accept", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test void likesAreUniquePersonalAndRequireVisibleActivity() throws Exception {
        String email = "activity-like-" + UUID.randomUUID() + "@example.com";
        var registration = call("POST", "/api/mobile/auth/register", null,
            json.writeValueAsString(Map.of("email", email, "password", "A-long-password-123", "firstName", "Nora", "lastName", "Mobile")));
        assertEquals(201, registration.statusCode(), registration.body());
        String token = json.readTree(registration.body()).get("token").asText();
        try {
            assertEquals(401, call("PUT", "/api/activities/chocolat/like", "invalid-token", null).statusCode());
            int before = json.readTree(call("GET", "/api/activities/chocolat", null, null).body()).get("likeCount").asInt();
            assertFalse(json.readTree(call("GET", "/api/activities/chocolat", null, null).body()).get("likedByMe").asBoolean());
            assertEquals(200, call("PUT", "/api/activities/chocolat/like", token, null).statusCode());
            assertEquals(200, call("PUT", "/api/activities/chocolat/like", token, null).statusCode());
            var liked = json.readTree(call("GET", "/api/activities/chocolat", token, null).body());
            assertEquals(before + 1, liked.get("likeCount").asInt());
            assertTrue(liked.get("likedByMe").asBoolean());
            assertEquals(404, call("PUT", "/api/activities/inconnue/like", token, null).statusCode());
            assertEquals(200, call("DELETE", "/api/activities/chocolat/like", token, null).statusCode());
            assertEquals(200, call("DELETE", "/api/activities/chocolat/like", token, null).statusCode());
            var unliked = json.readTree(call("GET", "/api/activities/chocolat", token, null).body());
            assertEquals(before, unliked.get("likeCount").asInt());
            assertFalse(unliked.get("likedByMe").asBoolean());
        } finally {
            jdbc.update("DELETE FROM like_activite WHERE utilisateur_id=(SELECT id FROM utilisateur WHERE email=?)", email);
            jdbc.update("DELETE FROM session_mobile WHERE utilisateur_id=(SELECT id FROM utilisateur WHERE email=?)", email);
            jdbc.update("DELETE FROM utilisateur WHERE email=?", email);
        }
    }
}
