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
class GroupPostApiTests {
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

    record Account(long id, String token) {}

    Account register(String email) throws Exception {
        var result = call("POST", "/api/mobile/auth/register", null,
            Map.of("email", email, "password", "Group-post-password-123", "firstName", "Nora", "lastName", "Mobile"));
        assertEquals(201, result.statusCode(), result.body());
        var body = json.readTree(result.body());
        return new Account(body.get("profile").get("id").asLong(), body.get("token").asText());
    }

    @Test void postsAndAnnouncementsStayWithinActiveMembership() throws Exception {
        String marker = UUID.randomUUID().toString();
        Account administrator = register("group-admin-" + marker + "@example.com");
        Account member = register("group-member-" + marker + "@example.com");
        Account outsider = register("group-outsider-" + marker + "@example.com");
        Long space = null, group = null;
        try {
            space = jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES (?,'ORGANISATEUR',?) RETURNING id",
                Long.class, "Groupe test " + marker, administrator.id());
            jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR'),(?,?,'MEMBRE')",
                administrator.id(), space, member.id(), space);
            group = jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,visibilite) VALUES (?,?,'PUBLIQUE') RETURNING id",
                Long.class, space, "Groupe test " + marker);
            jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE')",
                member.id(), space, group);
            String posts = "/api/groups/" + group + "/posts";
            assertEquals(200, call("GET", posts, member.token(), null).statusCode());
            assertEquals(404, call("GET", posts, outsider.token(), null).statusCode());
            assertEquals(404, call("POST", posts, outsider.token(), Map.of("requestId", UUID.randomUUID(), "content", "Intrusion")).statusCode());
            var body = Map.of("requestId", UUID.randomUUID(), "content", "Bonjour à tous !");
            var created = call("POST", posts, member.token(), body);
            assertEquals(201, created.statusCode(), created.body());
            long postId = json.readTree(created.body()).get("id").asLong();
            assertEquals(postId, json.readTree(call("POST", posts, member.token(), body).body()).get("id").asLong());
            assertEquals(409, call("POST", posts, member.token(), Map.of("requestId", body.get("requestId"), "content", "Autre contenu")).statusCode());
            assertEquals("Bonjour à tous !", json.readTree(call("GET", posts, administrator.token(), null).body()).get(0).get("content").asText());
            assertEquals(404, call("DELETE", posts + "/" + postId, outsider.token(), null).statusCode());
            var announcement = call("POST", "/api/group-announcements", administrator.token(),
                Map.of("requestId", UUID.randomUUID(), "groupId", group, "content", "Rendez-vous dimanche"));
            assertEquals(201, announcement.statusCode(), announcement.body());
            assertEquals("Rendez-vous dimanche", json.readTree(call("GET", "/api/groups/" + group + "/announcements", member.token(), null).body()).get(0).get("content").asText());
            jdbc.update("UPDATE appartenance_groupe SET statut='SUSPENDU' WHERE utilisateur_id=? AND groupe_id=?", member.id(), group);
            assertEquals(404, call("GET", posts, member.token(), null).statusCode());
            assertEquals(204, call("DELETE", posts + "/" + postId, administrator.token(), null).statusCode());
        } finally {
            if (group != null) {
                jdbc.update("DELETE FROM annonce_groupe WHERE groupe_id=?", group);
                jdbc.update("DELETE FROM publication_groupe_mobile WHERE groupe_id=?", group);
                jdbc.update("DELETE FROM appartenance_groupe WHERE groupe_id=?", group);
                jdbc.update("DELETE FROM groupe WHERE id=?", group);
            }
            if (space != null) {
                jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?", space);
                jdbc.update("DELETE FROM espace_organisateur WHERE id=?", space);
            }
            jdbc.update("DELETE FROM session_mobile WHERE utilisateur_id IN (?,?,?)", administrator.id(), member.id(), outsider.id());
            jdbc.update("DELETE FROM utilisateur WHERE id IN (?,?,?)", administrator.id(), member.id(), outsider.id());
        }
    }
}
