package be.belconnect.backend;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class MobileAuthApiTests {
  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired PasswordEncoder passwords;
  final ObjectMapper json=new ObjectMapper();
  final HttpClient client=HttpClient.newHttpClient();

  HttpResponse<String> request(String method,String path,Object body,String token) throws Exception {
    var builder=HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/mobile/auth/"+path)).header("Accept","application/json");
    if(token!=null) builder.header("Authorization","Bearer "+token);
    if(body!=null) builder.header("Content-Type","application/json").method(method,HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
    else builder.method(method,HttpRequest.BodyPublishers.noBody());
    return client.send(builder.build(),HttpResponse.BodyHandlers.ofString());
  }

  @Test void mobileTokenLifecycle() throws Exception {
    String email="mobile-"+UUID.randomUUID()+"@example.com",password="Mobile-test-"+UUID.randomUUID();
    try {
      var registration=Map.of("email",email.toUpperCase(Locale.ROOT),"password",password,"firstName","Nora","lastName","Mobile");
      var created=request("POST","register",registration,null);
      assertEquals(201,created.statusCode(),created.body());
      String token=json.readTree(created.body()).get("token").asText();
      assertEquals(43,token.length());
      assertFalse(created.body().contains(password));
      assertEquals(email,json.readTree(request("GET","me",null,token).body()).get("email").asText());
      assertEquals(401,request("GET","me",null,"invalid-token").statusCode());
      assertEquals(204,request("POST","logout",Map.of(),token).statusCode());
      assertEquals(401,request("GET","me",null,token).statusCode());

      var login=request("POST","login",Map.of("email",email,"password",password),null);
      assertEquals(200,login.statusCode(),login.body());
      String second=json.readTree(login.body()).get("token").asText();
      jdbc.update("UPDATE utilisateur SET mot_de_passe_hash=? WHERE email=?",passwords.encode("Replacement-"+UUID.randomUUID()),email);
      assertEquals(401,request("GET","me",null,second).statusCode());
    } finally { jdbc.update("DELETE FROM utilisateur WHERE email=?",email); }
  }
}
