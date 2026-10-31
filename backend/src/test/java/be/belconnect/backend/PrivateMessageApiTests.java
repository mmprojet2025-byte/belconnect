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
class PrivateMessageApiTests {
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
            Map.of("email", email, "password", "Private-message-password-123", "firstName", "Nora", "lastName", "Mobile"));
        assertEquals(201, result.statusCode(), result.body());
        var body = json.readTree(result.body());
        return new Account(body.get("profile").get("id").asLong(), body.get("token").asText());
    }

    @Test void conversationsArePrivateBlockedAndUnreadPerRecipient() throws Exception {
        String marker = UUID.randomUUID().toString();
        Account admin = register("dm-admin-" + marker + "@example.com");
        Account member = register("dm-member-" + marker + "@example.com");
        Account outsider = register("dm-outsider-" + marker + "@example.com");
        Long space = null, group = null;
        try {
            String avatarPath = "/api/mobile/auth/avatar";
            assertEquals(403, call("PUT", avatarPath, null, Map.of("avatarCode", "mint")).statusCode());
            assertEquals(400, call("PUT", avatarPath, admin.token(), Map.of("avatarCode", "unknown")).statusCode());
            var selectedAvatar = call("PUT", avatarPath, admin.token(), Map.of("avatarCode", "amber"));
            assertEquals(200, selectedAvatar.statusCode(), selectedAvatar.body());
            assertEquals("amber", json.readTree(call("GET", "/api/mobile/auth/me", admin.token(), null).body()).get("avatarCode").asText());
            space = jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES (?,'ORGANISATEUR',?) RETURNING id",
                Long.class, "Messagerie " + marker, admin.id());
            jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR'),(?,?,'MEMBRE')",
                admin.id(), space, member.id(), space);
            group = jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,visibilite) VALUES (?,?,'PUBLIQUE') RETURNING id",
                Long.class, space, "Messagerie " + marker);
            jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE')",
                member.id(), space, group);
            String base = "/api/mobile/messages";
            assertEquals(401, call("GET", base + "/conversations", null, null).statusCode());
            assertEquals(404, call("GET", base + "/groups/" + group + "/members", outsider.token(), null).statusCode());
            var members = json.readTree(call("GET", base + "/groups/" + group + "/members", member.token(), null).body());
            assertEquals(admin.id(), members.get(0).get("id").asLong());
            assertEquals("amber", members.get(0).get("avatarCode").asText());
            var body = Map.of("groupId", group, "recipientId", admin.id());
            assertEquals(404, call("POST", base + "/conversations", outsider.token(), body).statusCode());
            var started = call("POST", base + "/conversations", member.token(), body);
            assertEquals(200, started.statusCode(), started.body());
            assertEquals("amber", json.readTree(started.body()).get("otherAvatarCode").asText());
            long conversation = json.readTree(started.body()).get("id").asLong();
            assertEquals(conversation, json.readTree(call("POST", base + "/conversations", member.token(), body).body()).get("id").asLong());
            String path = base + "/conversations/" + conversation;
            assertEquals(404, call("GET", path, outsider.token(), null).statusCode());
            assertEquals(404, call("GET", path + "/profile", outsider.token(), null).statusCode());
            var profile = call("GET", path + "/profile", member.token(), null);
            assertEquals(200, profile.statusCode(), profile.body());
            assertEquals("dm-admin-" + marker + "@example.com", json.readTree(profile.body()).get("email").asText());
            assertEquals("amber", json.readTree(profile.body()).get("avatarCode").asText());
            assertEquals(404, call("GET", path + "/items", outsider.token(), null).statusCode());
            var messageBody = Map.of("requestId", UUID.randomUUID(), "content", "Salut, on se voit samedi ?");
            var sent = call("POST", path + "/items", member.token(), messageBody);
            assertEquals(201, sent.statusCode(), sent.body());
            long message = json.readTree(sent.body()).get("id").asLong();
            assertEquals(message, json.readTree(call("POST", path + "/items", member.token(), messageBody).body()).get("id").asLong());
            assertEquals(1, json.readTree(call("GET", path, admin.token(), null).body()).get("unreadCount").asInt());
            assertEquals(0, json.readTree(call("GET", path, member.token(), null).body()).get("unreadCount").asInt());
            assertEquals("Salut, on se voit samedi ?", json.readTree(call("GET", path + "/items", admin.token(), null).body()).get(0).get("content").asText());
            assertEquals(204, call("POST", path + "/read", admin.token(), null).statusCode());
            assertEquals(0, json.readTree(call("GET", path, admin.token(), null).body()).get("unreadCount").asInt());
            assertEquals(404, call("POST", base + "/items/" + message + "/reports", outsider.token(), Map.of("reason", "Spam")).statusCode());
            assertEquals(204, call("POST", base + "/items/" + message + "/reports", admin.token(), Map.of("reason", "Message gênant")).statusCode());
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM signalement_message_prive WHERE message_id=?", Integer.class, message));
            String moderation = "/api/workspace/owner/moderation/message-reports";
            assertEquals(403, call("GET", moderation, member.token(), null).statusCode());
            jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')", outsider.id());
            var reports = json.readTree(call("GET", moderation, outsider.token(), null).body());
            long reportId = jdbc.queryForObject("SELECT id FROM signalement_message_prive WHERE message_id=?", Long.class, message);
            assertTrue(reports.toString().contains("Message gênant"));
            assertEquals(204, call("POST", moderation + "/" + reportId + "/review", outsider.token(), null).statusCode());
            assertFalse(json.readTree(call("GET", moderation, outsider.token(), null).body()).toString().contains("Message gênant"));
            jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?", outsider.id());
            assertEquals(204, call("PUT", base + "/blocks/" + member.id(), admin.token(), null).statusCode());
            assertFalse(json.readTree(call("GET", path, admin.token(), null).body()).get("canSend").asBoolean());
            assertEquals(403, call("POST", path + "/items", member.token(), Map.of("requestId", UUID.randomUUID(), "content", "Autre message")).statusCode());
            assertEquals(204, call("DELETE", base + "/blocks/" + member.id(), admin.token(), null).statusCode());
            jdbc.update("UPDATE appartenance_groupe SET statut='SUSPENDU' WHERE utilisateur_id=? AND groupe_id=?", member.id(), group);
            assertEquals(404, call("GET", path + "/profile", member.token(), null).statusCode());
            assertEquals(404, call("POST", path + "/items", member.token(), Map.of("requestId", UUID.randomUUID(), "content", "Encore un message")).statusCode());
            assertEquals(200, call("GET", path + "/items", member.token(), null).statusCode());
        } finally {
            jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?", outsider.id());
            jdbc.update("DELETE FROM signalement_message_prive WHERE auteur_id IN (?,?,?)", admin.id(), member.id(), outsider.id());
            jdbc.update("DELETE FROM blocage_message_prive WHERE bloqueur_id IN (?,?,?) OR bloque_id IN (?,?,?)",
                admin.id(), member.id(), outsider.id(), admin.id(), member.id(), outsider.id());
            if (group != null) {
                jdbc.update("DELETE FROM message_prive WHERE conversation_id IN (SELECT id FROM conversation_privee WHERE groupe_id=?)", group);
                jdbc.update("DELETE FROM conversation_privee WHERE groupe_id=?", group);
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
