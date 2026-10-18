package be.belconnect.backend;
import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WorkspaceApiTests {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 final ObjectMapper json=new ObjectMapper();
 final HttpClient client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
 HttpResponse<String> get(String path) throws Exception {
  return client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).GET().build(),HttpResponse.BodyHandlers.ofString());
 }
 long register(String email) throws Exception {
  var token=json.readTree(get("/api/auth/csrf").body());
  var response=client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/auth/register"))
   .header("Content-Type","application/json").header(token.get("headerName").asText(),token.get("token").asText())
   .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("firstName","Camille","lastName","Test","email",email,"password","Test-only-"+UUID.randomUUID())))).build(),HttpResponse.BodyHandlers.ofString());
  assertEquals(201,response.statusCode(),response.body());
  return json.readTree(response.body()).get("id").asLong();
 }
 @Test void scopedRolesPrivateDraftsAndRevocation() throws Exception {
  String prefix="workspace-"+UUID.randomUUID();
  List<Long> users=new ArrayList<>(), spaces=new ArrayList<>();
  try {
   assertEquals(401,get("/api/workspace").statusCode());
   long other=register(prefix+"-other@example.com"); users.add(other);
   long me=register(prefix+"@example.com"); users.add(me);
   var empty=json.readTree(get("/api/workspace").body());
   assertFalse(empty.get("owner").asBoolean());
   for(String field:List.of("spaces","groups","projects","managedSpaces")) assertEquals(0,empty.get(field).size());
   long space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES (?,'ORGANISATEUR',?) RETURNING id",Long.class,prefix,other); spaces.add(space);
   long hidden=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES (?,'ORGANISATEUR',?) RETURNING id",Long.class,prefix+" hidden",other); spaces.add(hidden);
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",me,space);
   long group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,?) RETURNING id",Long.class,space,"Jardin partagé");
   long group2=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,?) RETURNING id",Long.class,space,"Atelier vélo");
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'REFERENT'),(?,?,?,'MEMBRE')",me,space,group,me,space,group2);
   jdbc.update("INSERT INTO projet(espace_id,auteur_id,titre,description,objectif) VALUES (?,?,'Mon brouillon','Texte','Objectif'),(?,?,'Brouillon privé autre','Secret','Objectif')",space,me,space,other);
   var overview=json.readTree(get("/api/workspace").body());
   assertEquals(1,overview.get("spaces").size());
   assertEquals("ADMINISTRATEUR",overview.get("spaces").get(0).get("role").asText());
   assertEquals(2,overview.get("groups").size()); assertTrue(overview.get("groups").toString().contains("REFERENT"));
   assertEquals(1,overview.get("projects").size());
   assertFalse(overview.toString().contains("Brouillon privé autre")); assertFalse(overview.toString().contains(" hidden"));
   jdbc.update("UPDATE appartenance_groupe SET statut='SUSPENDU' WHERE groupe_id=?",group);
   // An administrator retains direct access despite removal of a personal group role.
   assertEquals(2,json.readTree(get("/api/workspace").body()).get("groups").size());
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=?",me);
   var revoked=json.readTree(get("/api/workspace").body());
   assertEquals(0,revoked.get("spaces").size()); assertEquals(0,revoked.get("groups").size());
   jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",me);
   var owner=json.readTree(get("/api/workspace").body());
   assertTrue(owner.get("owner").asBoolean()); assertTrue(owner.get("managedSpaces").toString().contains(prefix+" hidden"));
   assertEquals(1,owner.get("projects").size());
   jdbc.update("UPDATE espace_organisateur SET statut='SUSPENDU' WHERE id=?",hidden);
   assertFalse(json.readTree(get("/api/workspace").body()).get("managedSpaces").toString().contains(prefix+" hidden"));
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",me);
   assertEquals(401,get("/api/workspace").statusCode());
  } finally {
   for(long id:users) { jdbc.update("DELETE FROM appartenance_groupe WHERE utilisateur_id=?",id); jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",id); }
   for(long id:spaces) {
    jdbc.update("DELETE FROM projet WHERE espace_id=?",id); jdbc.update("DELETE FROM groupe WHERE espace_id=?",id);
    jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",id); jdbc.update("DELETE FROM espace_organisateur WHERE id=?",id);
   }
   for(long id:users) jdbc.update("DELETE FROM utilisateur WHERE id=?",id);
  }
 }
}
