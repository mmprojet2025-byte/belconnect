package be.belconnect.backend;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSender;
import org.springframework.mail.SimpleMailMessage;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties={"MAIL_FROM=tests@example.com","APP_PUBLIC_URL=http://localhost:5173"})
@Import(PasswordRecoveryApiTests.MailConfig.class)
class PasswordRecoveryApiTests {
  @TestConfiguration static class MailConfig {
    @Bean CapturedMail capturedMail() { return new CapturedMail(); }
  }
  static class CapturedMail implements MailSender {
    final ConcurrentLinkedQueue<SimpleMailMessage> sent = new ConcurrentLinkedQueue<>();
    @Override public void send(SimpleMailMessage message) { sent.add(message); }
    @Override public void send(SimpleMailMessage... messages) { for(var message:messages) sent.add(message); }
  }
  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired CapturedMail mail;
  final ObjectMapper json = new ObjectMapper();
  final HttpClient client = HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
  HttpResponse<String> get(String path) throws Exception {
    return client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/auth/"+path)).GET().build(),HttpResponse.BodyHandlers.ofString());
  }
  HttpResponse<String> post(String path,Object body,boolean csrf) throws Exception {
    var builder=HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/auth/"+path)).header("Content-Type","application/json");
    if(csrf) {
      var token=json.readTree(get("csrf").body());
      builder.header(token.get("headerName").asText(),token.get("token").asText());
    }
    return client.send(builder.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
  }
  @Test void recoveryLinkIsPrivateExpiringAndSingleUse() throws Exception {
    String email="recovery-"+UUID.randomUUID()+"@example.com";
    String original="Original-only-"+UUID.randomUUID(), replacement="Replacement-only-"+UUID.randomUUID();
    mail.sent.clear();
    try {
      assertEquals(201,post("register",Map.of("firstName","Camille","lastName","Test","email",email,"password",original),true).statusCode());
      assertEquals(403,post("password/recovery",Map.of("email",email),false).statusCode());
      assertEquals(202,post("password/recovery",Map.of("email","absent-"+UUID.randomUUID()+"@example.com"),true).statusCode());
      assertTrue(mail.sent.isEmpty());
      assertEquals(202,post("password/recovery",Map.of("email",email),true).statusCode());
      var sent=mail.sent.poll(); assertNotNull(sent);
      assertEquals(email,sent.getTo()[0]);
      String body=sent.getText(); assertNotNull(body);
      assertFalse(body.contains(original));
      var match=java.util.regex.Pattern.compile("#jeton=([A-Za-z0-9_-]{43})").matcher(body);
      assertTrue(match.find()); String token=match.group(1);
      assertFalse(jdbc.queryForObject("SELECT jeton_hash FROM reinitialisation_mot_de_passe WHERE utilisateur_id=(SELECT id FROM utilisateur WHERE email=?)",String.class,email).equals(token));
      assertEquals(400,post("password/reset",Map.of("token","bad","password",replacement),true).statusCode());
      assertEquals(204,post("password/reset",Map.of("token",token,"password",replacement),true).statusCode());
      assertEquals(401,get("me").statusCode());
      assertEquals(400,post("password/reset",Map.of("token",token,"password",replacement),true).statusCode());
      assertEquals(401,post("login",Map.of("email",email,"password",original),true).statusCode());
      assertEquals(200,post("login",Map.of("email",email,"password",replacement),true).statusCode());
      assertEquals(202,post("password/recovery",Map.of("email",email),true).statusCode());
      var later=mail.sent.poll(); assertNotNull(later);
      var next=java.util.regex.Pattern.compile("#jeton=([A-Za-z0-9_-]{43})").matcher(later.getText()); assertTrue(next.find());
      jdbc.update("UPDATE reinitialisation_mot_de_passe SET date_expiration=now()-interval '1 second' WHERE utilisateur_id=(SELECT id FROM utilisateur WHERE email=?)",email);
      assertEquals(400,post("password/reset",Map.of("token",next.group(1),"password",original),true).statusCode());
    } finally { jdbc.update("DELETE FROM utilisateur WHERE email=?",email); mail.sent.clear(); }
  }
}
