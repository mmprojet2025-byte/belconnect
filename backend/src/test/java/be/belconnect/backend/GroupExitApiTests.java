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
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class GroupExitApiTests {
  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  final ObjectMapper json=new ObjectMapper();
  final HttpClient client=HttpClient.newHttpClient();
  record Account(long id,String token) {}

  HttpResponse<String> call(String method,String path,String token,Object body) throws Exception {
    var request=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Accept","application/json");
    if(token!=null)request.header("Authorization","Bearer "+token);
    if(body!=null)request.header("Content-Type","application/json");
    request.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
    return client.send(request.build(),HttpResponse.BodyHandlers.ofString());
  }

  Account register(String email) throws Exception {
    var result=call("POST","/api/mobile/auth/register",null,Map.of("email",email,"password","Group-exit-password-123","firstName","Test","lastName","Member"));
    assertEquals(201,result.statusCode(),result.body());
    var body=json.readTree(result.body());
    return new Account(body.get("profile").get("id").asLong(),body.get("token").asText());
  }

  @Test void memberCanLeaveAndRequestToJoinAgainWithoutUnlockingSuspendedMembers() throws Exception {
    String marker=UUID.randomUUID().toString();
    Account admin=register("group-exit-admin-"+marker+"@example.com"),member=register("group-exit-member-"+marker+"@example.com");
    long space=0,group=0;
    try {
      space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES (?,'ORGANISATEUR',?) RETURNING id",Long.class,"Exit "+marker,admin.id());
      jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR'),(?,?,'MEMBRE')",admin.id(),space,member.id(),space);
      group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,visibilite) VALUES (?,?,'PUBLIQUE') RETURNING id",Long.class,space,"Exit "+marker);
      jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE')",member.id(),space,group);
      jdbc.update("INSERT INTO demande_adhesion_groupe(utilisateur_id,groupe_id,espace_id,statut,date_decision) VALUES (?,?,?,'ACCEPTEE',now())",member.id(),group,space);
      String path="/api/groups/"+group;
      assertEquals(409,call("DELETE",path+"/membership",admin.token(),null).statusCode());
      assertEquals(204,call("DELETE",path+"/membership",member.token(),null).statusCode());
      assertEquals("RETIRE",jdbc.queryForObject("SELECT statut FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",String.class,member.id(),group));
      assertEquals(404,call("GET","/api/mobile/group-messages/groups/"+group+"/items",member.token(),null).statusCode());
      var request=call("POST",path+"/join",member.token(),null);
      assertEquals(200,request.statusCode(),request.body());
      long requestId=json.readTree(request.body()).get("id").asLong();
      assertEquals("EN_ATTENTE",json.readTree(request.body()).get("status").asText());
      assertEquals(200,call("POST","/api/group-memberships/"+requestId+"/decision",admin.token(),Map.of("version",1,"status","ACCEPTEE","reason","")).statusCode());
      assertEquals("ACTIF",jdbc.queryForObject("SELECT statut FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",String.class,member.id(),group));
    } finally {
      if(group>0) {
        jdbc.update("DELETE FROM notification_adhesion_groupe WHERE demande_id IN (SELECT id FROM demande_adhesion_groupe WHERE groupe_id=?)",group);
        jdbc.update("DELETE FROM demande_adhesion_groupe WHERE groupe_id=?",group);
        jdbc.update("DELETE FROM historique_gestion_espace WHERE groupe_id=?",group);
        jdbc.update("DELETE FROM appartenance_groupe WHERE groupe_id=?",group);
        jdbc.update("DELETE FROM groupe WHERE id=?",group);
      }
      if(space>0) { jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space); }
      jdbc.update("DELETE FROM utilisateur WHERE id IN (?,?)",admin.id(),member.id());
    }
  }
}
