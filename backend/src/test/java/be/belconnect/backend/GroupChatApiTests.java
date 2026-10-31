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
class GroupChatApiTests {
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
    Account register(String marker) throws Exception {
        var response = call("POST", "/api/mobile/auth/register", null,
            Map.of("email", marker + "@example.com", "password", "Group-chat-password-123", "firstName", "Nora", "lastName", "Mobile"));
        assertEquals(201, response.statusCode(), response.body());
        var body = json.readTree(response.body());
        return new Account(body.get("profile").get("id").asLong(), body.get("token").asText());
    }

    @Test void onlyCurrentMembersCanReadAndSendGroupMessages() throws Exception {
        String marker = UUID.randomUUID().toString();
        Account admin = register("chat-admin-" + marker), member = register("chat-member-" + marker), outsider = register("chat-outsider-" + marker);
        Long space = null, group = null;
        try {
            assertEquals(200, call("PUT", "/api/mobile/auth/avatar", member.token(), Map.of("avatarCode", "coral")).statusCode());
            space = jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES (?,'ORGANISATEUR',?) RETURNING id",
                Long.class, "Discussion test " + marker, admin.id());
            jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR'),(?,?,'MEMBRE')",
                admin.id(), space, member.id(), space);
            group = jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,visibilite) VALUES (?,?,'PRIVEE') RETURNING id",
                Long.class, space, "Discussion test " + marker);
            jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE')",
                member.id(), space, group);
            String base = "/api/mobile/group-messages/groups/" + group;
            assertEquals(0, json.readTree(call("GET", "/api/mobile/group-messages/conversations", outsider.token(), null).body()).size());
            assertEquals(404, call("GET", base + "/items", outsider.token(), null).statusCode());
            assertEquals(404, call("POST", base + "/items", outsider.token(), Map.of("requestId", UUID.randomUUID(), "content", "Intrusion")).statusCode());
            var payload = Map.of("requestId", UUID.randomUUID(), "content", "Bonjour au groupe !");
            var sent = call("POST", base + "/items", member.token(), payload);
            assertEquals(201, sent.statusCode(), sent.body());
            assertEquals("coral", json.readTree(sent.body()).get("senderAvatarCode").asText());
            long messageId = json.readTree(sent.body()).get("id").asLong();
            assertEquals(messageId, json.readTree(call("POST", base + "/items", member.token(), payload).body()).get("id").asLong());
            assertEquals(409, call("POST", base + "/items", member.token(), Map.of("requestId", payload.get("requestId"), "content", "Autre")).statusCode());
            assertEquals("Bonjour au groupe !", json.readTree(call("GET", base + "/items", admin.token(), null).body()).get(0).get("content").asText());
            assertEquals("coral", json.readTree(call("GET", base + "/items", admin.token(), null).body()).get(0).get("senderAvatarCode").asText());
            var adminList = json.readTree(call("GET", "/api/mobile/group-messages/conversations", admin.token(), null).body());
            assertEquals(1, adminList.get(0).get("unreadCount").asInt());
            assertEquals(204, call("POST", base + "/read", admin.token(), Map.of("lastSeenId", messageId)).statusCode());
            assertEquals(0, json.readTree(call("GET", "/api/mobile/group-messages/conversations", admin.token(), null).body()).get(0).get("unreadCount").asInt());
            jdbc.update("UPDATE appartenance_groupe SET statut='SUSPENDU' WHERE utilisateur_id=? AND groupe_id=?", member.id(), group);
            assertEquals(404, call("GET", base + "/items", member.token(), null).statusCode());
            assertEquals(404, call("POST", base + "/items", member.token(), Map.of("requestId", UUID.randomUUID(), "content", "Encore")).statusCode());
            assertEquals(0, json.readTree(call("GET", "/api/mobile/group-messages/conversations", member.token(), null).body()).size());
        } finally {
            if (group != null) {
                jdbc.update("DELETE FROM lecture_message_groupe WHERE groupe_id=?", group);
                jdbc.update("DELETE FROM message_groupe WHERE groupe_id=?", group);
                jdbc.update("DELETE FROM appartenance_groupe WHERE groupe_id=?", group);
                jdbc.update("DELETE FROM groupe WHERE id=?", group);
            }
            if (space != null) {
                jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?", space);
                jdbc.update("DELETE FROM espace_organisateur WHERE id=?", space);
            }
            jdbc.update("DELETE FROM session_mobile WHERE utilisateur_id IN (?,?,?)", admin.id(), member.id(), outsider.id());
            jdbc.update("DELETE FROM utilisateur WHERE id IN (?,?,?)", admin.id(), member.id(), outsider.id());
        }
    }
}
