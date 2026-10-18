package be.belconnect.backend;
import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthApiTests {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 @Autowired PasswordEncoder encoder;
 final ObjectMapper json = new ObjectMapper();
 final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
 final HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();
 HttpResponse<String> get(String path) throws Exception { return client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/auth/"+path)).GET().build(),HttpResponse.BodyHandlers.ofString()); }
 HttpResponse<String> post(String path, Object body, boolean csrf) throws Exception {
  var builder = HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/auth/"+path)).header("Content-Type","application/json");
  if(csrf) { var token=json.readTree(get("csrf").body()); builder.header(token.get("headerName").asText(),token.get("token").asText()); }
  return client.send(builder.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
 }
 @Test void completeAccountLifecycleAndSecurity() throws Exception {
  String email="auth-test-"+UUID.randomUUID()+"@example.com", password="Test-only-"+UUID.randomUUID();
  var registration=Map.of("email",email.toUpperCase(Locale.ROOT),"password",password,"firstName","Camille","lastName","Test");
  try {
   assertEquals(401,get("me").statusCode());
   assertEquals(403,post("register",registration,false).statusCode());
   get("csrf");
   var before=cookies.getCookieStore().getCookies().stream().filter(c->c.getName().equals("JSESSIONID")).findFirst().orElseThrow().getValue();
   var created=post("register",registration,true);
   assertEquals(201,created.statusCode(),created.body());
   assertFalse(created.body().contains(password)); assertFalse(created.body().contains("passwordHash"));
   var after=cookies.getCookieStore().getCookies().stream().filter(c->c.getName().equals("JSESSIONID")).findFirst().orElseThrow();
   assertNotEquals(before,after.getValue()); assertTrue(after.isHttpOnly());
   assertTrue(created.headers().allValues("set-cookie").stream().anyMatch(v->v.contains("SameSite=Lax")));
   String hash=jdbc.queryForObject("SELECT mot_de_passe_hash FROM utilisateur WHERE email=?",String.class,email);
   assertNotEquals(password,hash); assertTrue(encoder.matches(password,hash));
   assertEquals(email,json.readTree(get("me").body()).get("email").asText());
   assertEquals(409,post("register",registration,true).statusCode());
   assertEquals(403,post("logout",Map.of(),false).statusCode());
   assertEquals(204,post("logout",Map.of(),true).statusCode());
   assertEquals(401,get("me").statusCode());
   assertEquals(401,post("login",Map.of("email",email,"password","incorrect-password"),true).statusCode());
   assertEquals(200,post("login",Map.of("email",email,"password",password),true).statusCode());
   assertEquals(200,get("me").statusCode());
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE email=?",email);
   assertEquals(401,get("me").statusCode());
   assertEquals(401,post("login",Map.of("email",email,"password",password),true).statusCode());
   var weak=new HashMap<>(registration); weak.put("password","short");
   assertEquals(400,post("register",weak,true).statusCode());
   weak.put("password","é".repeat(40));
   assertEquals(400,post("register",weak,true).statusCode());
  } finally { jdbc.update("DELETE FROM utilisateur WHERE email=?",email); }
 }
}
