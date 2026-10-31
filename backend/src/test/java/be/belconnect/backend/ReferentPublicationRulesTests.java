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
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class ReferentPublicationRulesTests {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 @Autowired be.belconnect.backend.auth.AuthController testAuth;
 // Each HTTP scenario has its own quota; never alter the application's rate limit.
 @org.junit.jupiter.api.BeforeEach @org.junit.jupiter.api.AfterEach
 void isolateAuthenticationQuota() {
  ((Map<?,?>) java.util.Objects.requireNonNull(org.springframework.test.util.ReflectionTestUtils.getField(testAuth,"attempts"))).clear();
 }

 final ObjectMapper json=new ObjectMapper();
 class Session {
  final HttpClient client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
  HttpResponse<String> get(String path) throws Exception {return client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).GET().build(),HttpResponse.BodyHandlers.ofString());}
  HttpResponse<String> post(String path,Object body,boolean csrf) throws Exception {
   var b=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Content-Type","application/json");
   if(csrf) { var t=json.readTree(get("/api/auth/csrf").body());b.header(t.get("headerName").asText(),t.get("token").asText()); }
   return client.send(b.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
  }
  long register() throws Exception {
   var r=post("/api/auth/register",Map.of("email","draft-"+UUID.randomUUID()+"@example.com","password","Draft-test-"+UUID.randomUUID(),"firstName","Test","lastName","Brouillon"),true);
   assertEquals(201,r.statusCode(),r.body());return json.readTree(r.body()).get("id").asLong();
  }
 }

 @Test void referentIsScopedAndNeedsAdministratorPublication() throws Exception {
  var admin=new Session(); long aid=admin.register(); var ref=new Session();long rid=ref.register();var member=new Session();long mid=member.register();
  long space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Rules test','ORGANISATEUR',?) RETURNING id",Long.class,aid);
  try {
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR'),(?,?,'MEMBRE'),(?,?,'MEMBRE')",aid,space,rid,space,mid,space);
   long group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,referents_gerent_activites) VALUES (?,'Delegated',true) RETURNING id",Long.class,space);
   long other=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,referents_gerent_activites) VALUES (?,'Other',true) RETURNING id",Long.class,space);
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'REFERENT'),(?,?,?,'MEMBRE')",rid,space,group,mid,space,group);
   assertEquals(409,admin.post("/api/workspace/groups/"+group+"/members/"+mid+"/role",Map.of("version",0,"role","REFERENT"),true).statusCode());
   var content=new HashMap<String,Object>();content.put("title","Activity for approval");content.put("category","nature");content.put("city","Bruxelles");content.put("location","Parc test");content.put("image","balade");content.put("startsAt",java.time.OffsetDateTime.now().plusDays(30).toString());content.put("endsAt",java.time.OffsetDateTime.now().plusDays(30).plusHours(2).toString());content.put("closesAt",java.time.OffsetDateTime.now().plusDays(29).toString());content.put("description","Test publication approval");content.put("duration","2 h");content.put("capacity",10);content.put("audience","Adultes");content.put("meetingPoint","Entrée");content.put("preparation","");content.put("visibility","PUBLIQUE");
   for(int price:List.of(0,5)) {
    content.put("price",price);
    var created=ref.post("/api/managed-activities",Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",content),true);
    assertEquals(201,created.statusCode(),created.body());long id=json.readTree(created.body()).get("id").asLong();
    assertEquals(403,ref.post("/api/managed-activities/"+id+"/publication",Map.of("version",0,"published",true),true).statusCode());
    var submitted=ref.post("/api/managed-activities/"+id+"/submit",Map.of("version",0),true);assertEquals(200,submitted.statusCode(),submitted.body());assertTrue(json.readTree(submitted.body()).get("publicationRequested").asBoolean());
    assertTrue(admin.get("/api/managed-activities/publication-requests").body().contains("Activity for approval"));
    assertEquals("[]",ref.get("/api/managed-activities/publication-requests").body());
    assertEquals(403,ref.post("/api/managed-activities",Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",other,"content",content),true).statusCode());
    if(price==0) assertEquals(200,admin.post("/api/managed-activities/"+id+"/publication",Map.of("version",1,"published",true),true).statusCode());
   }
   var projectContent=Map.of("title","Projet du référent","description","Description du projet","objective","Objectif du projet","visibility","PUBLIQUE");
   var body=Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",projectContent);
   assertEquals(403,member.post("/api/project-drafts",body,true).statusCode());
   var created=ref.post("/api/project-drafts",body,true);assertEquals(201,created.statusCode(),created.body());long pid=json.readTree(created.body()).get("id").asLong();
   var submitted=ref.post("/api/project-drafts/"+pid+"/submit",Map.of("version",0),true);assertEquals(200,submitted.statusCode(),submitted.body());assertEquals("ADMINISTRATEUR",json.readTree(submitted.body()).get("reviewStage").asText());
  } finally {
   jdbc.update("DELETE FROM soumission_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM projet WHERE espace_id=?",space);
   jdbc.update("DELETE FROM historique_gestion_activite WHERE activite_id IN (SELECT id FROM activite WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM activite WHERE espace_id=?",space);
   jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",space);jdbc.update("DELETE FROM groupe WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
   for(long id:List.of(aid,rid,mid)) jdbc.update("DELETE FROM utilisateur WHERE id=?",id);
  }
 }
}
