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
class DraftApiTests {
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
 Map<String,Object> content(String title) {return Map.of("title",title,"description","","objective","");}
 Map<String,Object> creation(long space,Long group) {
  var body=new HashMap<String,Object>();body.put("spaceId",space);body.put("groupId",group);body.put("requestId",UUID.randomUUID());body.put("content",content("Une idée de projet"));return body;
 }
 @Test void privateDraftLifecycleAndPermissions() throws Exception {
  var author=new Session();var other=new Session();var anonymous=new Session();
  List<Long> users=new ArrayList<>(),spaces=new ArrayList<>();
  try {
   long uid=author.register();users.add(uid);long outsider=other.register();users.add(outsider);
   long space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Test brouillons','ORGANISATEUR',?) RETURNING id",Long.class,outsider);spaces.add(space);
   long foreignSpace=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Autre espace','ORGANISATEUR',?) RETURNING id",Long.class,outsider);spaces.add(foreignSpace);
   long group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,'Groupe test') RETURNING id",Long.class,space);
   long foreignGroup=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,'Autre groupe') RETURNING id",Long.class,foreignSpace);
   var body=creation(space,null);
   assertEquals(401,anonymous.post("/api/project-drafts",body,true).statusCode());
   assertEquals(403,author.post("/api/project-drafts",body,false).statusCode());
   assertEquals(403,author.post("/api/project-drafts",body,true).statusCode());
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE'),(?,?,'ADMINISTRATEUR')",uid,space,outsider,space);
   jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",outsider);
   assertEquals(403,author.post("/api/project-drafts",creation(space,group),true).statusCode());
   assertEquals(403,author.post("/api/project-drafts",creation(space,foreignGroup),true).statusCode());
   var invalid=creation(space,null);invalid.put("content",content("    "));
   assertEquals(400,author.post("/api/project-drafts",invalid,true).statusCode());
   invalid.put("content",Map.of("title","Dates inversées","description","","objective","","startsOn","2027-02-10","endsOn","2027-02-01"));
   assertEquals(400,author.post("/api/project-drafts",invalid,true).statusCode());
   invalid.put("content",Map.of("title","Image invalide","description","","objective","","imageUrl","javascript:alert(1)"));
   assertEquals(400,author.post("/api/project-drafts",invalid,true).statusCode());
   invalid.put("content",Map.of("title","Aide invalide","description","","objective","","helpTypes",List.of()));
   assertEquals(400,author.post("/api/project-drafts",invalid,true).statusCode());
   invalid.put("content",Map.of("title","Projet de groupe","description","","objective","","visibility","GROUPE"));
   assertEquals(400,author.post("/api/project-drafts",invalid,true).statusCode());
   invalid.put("content",Map.of("title","Audience invalide","description","","objective","","visibility","PRIVEE"));
   assertEquals(400,author.post("/api/project-drafts",invalid,true).statusCode());
   var created=author.post("/api/project-drafts",body,true);assertEquals(201,created.statusCode(),created.body());
   long id=json.readTree(created.body()).get("id").asLong();
   assertEquals(id,json.readTree(author.post("/api/project-drafts",body,true).body()).get("id").asLong());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM projet WHERE auteur_id=?",Integer.class,uid));
   body.put("content",content("Changement après réponse perdue"));
   assertEquals(409,author.post("/api/project-drafts",body,true).statusCode());
   assertEquals("BROUILLON",jdbc.queryForObject("SELECT statut FROM projet WHERE id=?",String.class,id));
   assertEquals(404,other.get("/api/project-drafts/"+id).statusCode());
   assertEquals(401,anonymous.get("/api/project-drafts/"+id).statusCode());
   var update=Map.of("version",0,"content",Map.of("title","Titre modifié du brouillon","description","","objective","","imageUrl","https://example.com/projet.jpg","helpTypes",List.of("BENEVOLAT","PARTAGE")));
   assertEquals(403,author.post("/api/project-drafts/"+id,update,false).statusCode());
   assertEquals(403,other.post("/api/project-drafts/"+id,update,true).statusCode());
   var saved=author.post("/api/project-drafts/"+id,update,true);assertEquals(200,saved.statusCode(),saved.body());
   assertEquals(1,json.readTree(saved.body()).get("version").asLong());
   assertEquals(409,author.post("/api/project-drafts/"+id,update,true).statusCode());
   assertEquals("Titre modifié du brouillon",json.readTree(author.get("/api/project-drafts/"+id).body()).get("title").asText());
   assertEquals("https://example.com/projet.jpg",json.readTree(author.get("/api/project-drafts/"+id).body()).get("imageUrl").asText());
   assertEquals(2,json.readTree(author.get("/api/project-drafts/"+id).body()).get("helpTypes").size());
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE')",uid,space,group);
   var groupedRequest=creation(space,group);
   groupedRequest.put("content",Map.of("title","Une idée de groupe","description","","objective","","visibility","GROUPE"));
   var grouped=author.post("/api/project-drafts",groupedRequest,true);assertEquals(201,grouped.statusCode(),grouped.body());
   long groupedId=json.readTree(grouped.body()).get("id").asLong();
   assertEquals("GROUPE",json.readTree(grouped.body()).get("visibility").asText());
   assertEquals("GROUPE",jdbc.queryForObject("SELECT visibilite FROM projet WHERE id=?",String.class,groupedId));
   assertEquals(200,author.post("/api/project-drafts/"+groupedId,Map.of("version",0,"content",Map.of("title","Une idée de groupe","description","","objective","","visibility","PUBLIQUE")),true).statusCode());
   assertEquals("PUBLIQUE",jdbc.queryForObject("SELECT visibilite FROM projet WHERE id=?",String.class,groupedId));
   jdbc.update("UPDATE appartenance_groupe SET statut='RETIRE' WHERE utilisateur_id=?",uid);
   assertEquals(403,author.post("/api/project-drafts/"+groupedId,update,true).statusCode());
   jdbc.update("UPDATE projet SET statut='SOUMIS' WHERE id=?",id);
   assertEquals(404,author.post("/api/project-drafts/"+id,Map.of("version",1,"content",content("Ne doit pas écraser")),true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='SUSPENDU' WHERE utilisateur_id=?",uid);
   assertEquals(403,author.post("/api/project-drafts",creation(space,null),true).statusCode());
   assertEquals(200,author.get("/api/project-drafts/"+groupedId).statusCode());
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",uid);
   assertEquals(401,author.get("/api/project-drafts/"+groupedId).statusCode());
  } finally {
   for(long id:spaces) {jdbc.update("DELETE FROM projet WHERE espace_id=?",id);jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",id);jdbc.update("DELETE FROM groupe WHERE espace_id=?",id);jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",id);jdbc.update("DELETE FROM espace_organisateur WHERE id=?",id);}
   for(long id:users) {jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",id);jdbc.update("DELETE FROM utilisateur WHERE id=?",id);}
  }
 }
 @Test void submissionRoutingVisibilityAndRetries() throws Exception {
  var author=new Session();var admin=new Session();var referent=new Session();var outsider=new Session();
  List<Long> users=new ArrayList<>();Long space=null;
  try {
   long uid=author.register();users.add(uid);long aid=admin.register();users.add(aid);long rid=referent.register();users.add(rid);long oid=outsider.register();users.add(oid);
   space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Test soumission','ORGANISATEUR',?) RETURNING id",Long.class,aid);
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE'),(?,?,'ADMINISTRATEUR'),(?,?,'MEMBRE')",uid,space,aid,space,rid,space);
   long group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,'Groupe soumis') RETURNING id",Long.class,space);
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE'),(?,?,?,'REFERENT')",uid,space,group,rid,space,group);
   jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",oid);
   var body=creation(space,group);
   long id=json.readTree(author.post("/api/project-drafts",body,true).body()).get("id").asLong();
   String path="/api/project-drafts/"+id+"/submit";
   assertFalse(admin.get("/api/project-reviews").body().contains("Une idée de projet"));
   assertEquals(404,referent.get("/api/project-reviews/"+id).statusCode());
   assertEquals(403,author.post(path,Map.of("version",0),false).statusCode());
   assertEquals(401,new Session().post(path,Map.of("version",0),true).statusCode());
   assertEquals(404,admin.post(path,Map.of("version",0),true).statusCode());
   assertEquals(400,author.post(path,Map.of("version",0),true).statusCode());
   var complete=Map.of("title","Projet soumis pour examen","description","Description complète du projet.","objective","Rencontrer les habitants du quartier.");
   assertEquals(200,author.post("/api/project-drafts/"+id,Map.of("version",0,"content",complete),true).statusCode());
   assertEquals(409,author.post(path,Map.of("version",0),true).statusCode());
   var sent=author.post(path,Map.of("version",1),true);assertEquals(200,sent.statusCode(),sent.body());
   assertEquals("REFERENT",json.readTree(sent.body()).get("reviewStage").asText());
   assertEquals(200,author.post(path,Map.of("version",1),true).statusCode());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM soumission_projet WHERE projet_id=?",Integer.class,id));
   assertEquals("SOUMIS",jdbc.queryForObject("SELECT statut FROM projet WHERE id=?",String.class,id));
   assertEquals(2,jdbc.queryForObject("SELECT version FROM projet WHERE id=?",Long.class,id));
   assertEquals(404,author.post("/api/project-drafts/"+id,Map.of("version",2,"content",complete),true).statusCode());
   assertEquals(200,author.get("/api/project-reviews/"+id).statusCode());
   assertEquals(200,referent.get("/api/project-reviews/"+id).statusCode());
   assertEquals(200,admin.get("/api/project-reviews/"+id).statusCode());
   assertEquals(404,outsider.get("/api/project-reviews/"+id).statusCode());
   assertEquals(401,new Session().get("/api/project-reviews/"+id).statusCode());
   assertTrue(referent.get("/api/project-reviews").body().contains("Projet soumis pour examen"));
   assertFalse(outsider.get("/api/project-reviews").body().contains("Projet soumis pour examen"));
   jdbc.update("UPDATE appartenance_groupe SET statut='RETIRE' WHERE utilisateur_id=?",rid);
   assertEquals(404,referent.get("/api/project-reviews/"+id).statusCode());
   // A group without an eligible referent goes directly to its space administrator.
   var fallback=creation(space,group);fallback.put("content",complete);
   long fallbackId=json.readTree(author.post("/api/project-drafts",fallback,true).body()).get("id").asLong();
   var fallbackSent=author.post("/api/project-drafts/"+fallbackId+"/submit",Map.of("version",0),true);
   assertEquals("ADMINISTRATEUR",json.readTree(fallbackSent.body()).get("reviewStage").asText());
   var direct=creation(space,null);direct.put("content",complete);
   long directId=json.readTree(author.post("/api/project-drafts",direct,true).body()).get("id").asLong();
   String directPath="/api/project-drafts/"+directId+"/submit";
   var first=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return author.post(directPath,Map.of("version",0),true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   var second=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return author.post(directPath,Map.of("version",0),true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   assertEquals(200,first.get());assertEquals(200,second.get());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM soumission_projet WHERE projet_id=?",Integer.class,directId));
   assertEquals("ADMINISTRATEUR",jdbc.queryForObject("SELECT etape_validation FROM projet WHERE id=?",String.class,directId));
   var fourth=creation(space,null); fourth.put("content",complete);
   long fourthId=json.readTree(author.post("/api/project-drafts",fourth,true).body()).get("id").asLong();
   assertEquals(409,author.post("/api/project-drafts/"+fourthId+"/submit",Map.of("version",0),true).statusCode());
   assertEquals("BROUILLON",jdbc.queryForObject("SELECT statut FROM projet WHERE id=?",String.class,fourthId));
   jdbc.update("UPDATE projet SET statut='REFUSE' WHERE id=?",fallbackId);
   assertEquals(200,author.post("/api/project-drafts/"+fourthId+"/submit",Map.of("version",0),true).statusCode());
   direct.put("requestId",UUID.randomUUID());
   long deniedId=json.readTree(author.post("/api/project-drafts",direct,true).body()).get("id").asLong();
   jdbc.update("UPDATE appartenance_espace SET statut='SUSPENDU' WHERE utilisateur_id=?",uid);
   assertEquals(403,author.post("/api/project-drafts/"+deniedId+"/submit",Map.of("version",0),true).statusCode());
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",rid);
   assertEquals(401,referent.get("/api/project-reviews").statusCode());
  } finally {
   if(space!=null) {
    jdbc.update("DELETE FROM soumission_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
    jdbc.update("DELETE FROM projet WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",space);
    jdbc.update("DELETE FROM groupe WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
   }
   for(long id:users) {jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",id);jdbc.update("DELETE FROM utilisateur WHERE id=?",id);}
  }
 }

 @Test void referentCorrectionsResubmissionAndConcurrentAdvice() throws Exception {
  var author=new Session();var ref1=new Session();var ref2=new Session();var admin=new Session();
  List<Long> users=new ArrayList<>();Long space=null;
  try {
   long uid=author.register();users.add(uid);long r1=ref1.register();users.add(r1);long r2=ref2.register();users.add(r2);long aid=admin.register();users.add(aid);
   space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Avis test','ORGANISATEUR',?) RETURNING id",Long.class,aid);
   for(long u:users) jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,?)",u,space,u==aid?"ADMINISTRATEUR":"MEMBRE");
   long group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,'Référents test') RETURNING id",Long.class,space);
   for(long u:List.of(uid,r1,r2)) jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'REFERENT')",u,space,group);
   var content=Map.of("title","Jardin partagé à examiner","description","Plan de jardin pour le quartier.","objective","Cultiver ensemble.");
   var body=creation(space,group);body.put("content",content);
   var created=author.post("/api/project-drafts",body,true);assertEquals(201,created.statusCode(),created.body());
   long id=json.readTree(created.body()).get("id").asLong();
   String draft="/api/project-drafts/"+id, review="/api/project-reviews/"+id, opinion=review+"/opinion";
   assertEquals(200,author.post(draft+"/submit",Map.of("version",0),true).statusCode());
   assertTrue(json.readTree(ref1.get(review).body()).get("canReview").asBoolean());
   assertFalse(json.readTree(author.get(review).body()).get("canReview").asBoolean());
   assertFalse(json.readTree(admin.get(review).body()).get("canReview").asBoolean());
   var correction=Map.of("version",1,"decision","A_CORRIGER","comment","Précisez le budget des outils.");
   assertEquals(403,ref1.post(opinion,correction,false).statusCode());
   assertEquals(401,new Session().post(opinion,correction,true).statusCode());
   assertEquals(403,author.post(opinion,correction,true).statusCode());
   assertEquals(404,admin.post(opinion,correction,true).statusCode());
   assertEquals(400,ref1.post(opinion,Map.of("version",1,"decision","A_CORRIGER","comment","   "),true).statusCode());
   assertEquals(400,ref1.post(opinion,Map.of("version",1,"decision","APPROUVE","comment",""),true).statusCode());
   assertEquals(409,ref1.post(opinion,Map.of("version",0,"decision","AVIS_FAVORABLE","comment",""),true).statusCode());
   var corrected=ref1.post(opinion,correction,true);assertEquals(200,corrected.statusCode(),corrected.body());
   assertEquals("A_CORRIGER",json.readTree(corrected.body()).get("status").asText());
   assertEquals(200,ref1.post(opinion,correction,true).statusCode());
   assertEquals(409,ref2.post(opinion,correction,true).statusCode());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM validation_projet WHERE projet_id=?",Integer.class,id));
   assertEquals(404,ref1.get(review).statusCode());assertEquals(404,admin.get(review).statusCode());
   var returned=json.readTree(author.get(draft).body());
   assertEquals("A_CORRIGER",returned.get("status").asText());
   assertEquals("Précisez le budget des outils.",returned.get("reviews").get(0).get("comment").asText());
   var revised=Map.of("title","Jardin partagé à examiner","description","Budget outils précisé : 150 euros.","objective","Cultiver ensemble.");
   assertEquals(200,author.post(draft,Map.of("version",2,"content",revised),true).statusCode());
   assertEquals("A_CORRIGER",jdbc.queryForObject("SELECT statut FROM projet WHERE id=?",String.class,id));
   assertEquals(404,ref1.get(draft).statusCode());
   assertEquals(404,ref1.get(review).statusCode());
   assertEquals(200,author.post(draft+"/submit",Map.of("version",3),true).statusCode());
   assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM soumission_projet WHERE projet_id=?",Integer.class,id));
   assertEquals("Budget outils précisé : 150 euros.",json.readTree(ref1.get(review).body()).get("description").asText());
   jdbc.update("UPDATE appartenance_groupe SET statut='SUSPENDU' WHERE utilisateur_id=?",r2);
   var favorable=Map.of("version",4,"decision","AVIS_FAVORABLE","comment","Le budget est clair.");
   assertEquals(404,ref2.post(opinion,favorable,true).statusCode());
   jdbc.update("UPDATE appartenance_groupe SET statut='ACTIF' WHERE utilisateur_id=?",r2);
   var first=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return ref1.post(opinion,favorable,true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   var second=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return ref2.post(opinion,favorable,true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   assertEquals(java.util.Set.of(200,409),java.util.Set.of(first.get(),second.get()));
   assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM validation_projet WHERE projet_id=?",Integer.class,id));
   assertEquals("SOUMIS",jdbc.queryForObject("SELECT statut FROM projet WHERE id=?",String.class,id));
   assertEquals("ADMINISTRATEUR",jdbc.queryForObject("SELECT etape_validation FROM projet WHERE id=?",String.class,id));
   var finalView=json.readTree(admin.get(review).body());assertEquals(2,finalView.get("reviews").size());assertFalse(finalView.get("canReview").asBoolean());
   assertEquals(404,author.get(draft).statusCode());
  } finally {
   if(space!=null) {
    jdbc.update("DELETE FROM validation_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
    jdbc.update("DELETE FROM soumission_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
    jdbc.update("DELETE FROM projet WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",space);
    jdbc.update("DELETE FROM groupe WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
   }
   for(long u:users) jdbc.update("DELETE FROM utilisateur WHERE id=?",u);
  }
 }

 @Test void administratorFinalDecisionPermissionsAndConcurrency() throws Exception {
  var author=new Session();var admin=new Session();var second=new Session();var outsider=new Session();
  List<Long> users=new ArrayList<>();Long space=null;
  try {
   long uid=author.register();users.add(uid);long aid=admin.register();users.add(aid);long bid=second.register();users.add(bid);long oid=outsider.register();users.add(oid);
   space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Décisions test','ORGANISATEUR',?) RETURNING id",Long.class,aid);
   for(long u:List.of(uid,aid,bid)) jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",u,space);
   jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",oid);
   long group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,'Groupe décisions') RETURNING id",Long.class,space);
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE'),(?,?,?,'REFERENT')",uid,space,group,bid,space,group);
   var body=creation(space,group);body.put("content",Map.of("title","Projet décision finale","description","Description complète.","objective","Réunir les voisins."));
   long id=json.readTree(author.post("/api/project-drafts",body,true).body()).get("id").asLong();
   String review="/api/project-reviews/"+id, path=review+"/decision";
   var approve=Map.of("version",1,"decision","APPROUVE","comment","Projet prêt.");
   assertEquals(404,admin.post(path,approve,true).statusCode());
   assertEquals(200,author.post("/api/project-drafts/"+id+"/submit",Map.of("version",0),true).statusCode());
   assertEquals("REFERENT",jdbc.queryForObject("SELECT etape_validation FROM projet WHERE id=?",String.class,id));
   assertTrue(json.readTree(admin.get(review).body()).get("canDecide").asBoolean());
   assertFalse(json.readTree(author.get(review).body()).get("canDecide").asBoolean());
   assertEquals(401,new Session().post(path,approve,true).statusCode());
   assertEquals(403,admin.post(path,approve,false).statusCode());
   assertEquals(403,author.post(path,approve,true).statusCode());
   assertEquals(403,outsider.post(path,approve,true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET role='MEMBRE' WHERE utilisateur_id=?",bid);
   assertEquals(404,second.post(path,approve,true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET role='ADMINISTRATEUR' WHERE utilisateur_id=?",bid);
   assertEquals(400,admin.post(path,Map.of("version",1,"decision","REFUSE","comment","  "),true).statusCode());
   assertEquals(400,admin.post(path,Map.of("version",1,"decision","AVIS_FAVORABLE"),true).statusCode());
   assertEquals(409,admin.post(path,Map.of("version",0,"decision","APPROUVE"),true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=?",aid);
   assertEquals(404,admin.post(path,approve,true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='ACTIF' WHERE utilisateur_id=?",aid);
   var accepted=admin.post(path,approve,true);assertEquals(200,accepted.statusCode(),accepted.body());
   assertEquals(200,admin.post(path,approve,true).statusCode());
   assertEquals(409,second.post(path,approve,true).statusCode());
   var viewed=json.readTree(author.get(review).body());assertEquals("APPROUVE",viewed.get("status").asText());assertFalse(viewed.get("canDecide").asBoolean());assertEquals(1,viewed.get("reviews").size());
   assertEquals(404,author.get("/api/project-drafts/"+id).statusCode());
   assertEquals(404,outsider.get(review).statusCode());
   assertFalse(admin.get("/api/project-reviews").body().contains("Projet décision finale"));
   // No group / direct administrator route, with a documented refusal.
   body=creation(space,null);body.put("content",Map.of("title","Projet refusé avec motif","description","Description.","objective","Objectif."));
   long refused=json.readTree(author.post("/api/project-drafts",body,true).body()).get("id").asLong();
   assertEquals(200,author.post("/api/project-drafts/"+refused+"/submit",Map.of("version",0),true).statusCode());
   String refusalPath="/api/project-reviews/"+refused+"/decision";
   var refusal=Map.of("version",1,"decision","REFUSE","comment","Le lieu proposé est indisponible.");
   var first=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return admin.post(refusalPath,refusal,true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   var other=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return second.post(refusalPath,refusal,true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   assertEquals(Set.of(200,409),Set.of(first.get(),other.get()));
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM validation_projet WHERE projet_id=?",Integer.class,refused));
   var result=json.readTree(author.get("/api/project-reviews/"+refused).body());assertEquals("REFUSE",result.get("status").asText());assertEquals("Le lieu proposé est indisponible.",result.get("reviews").get(0).get("comment").asText());
   assertEquals(409,author.post("/api/project-drafts/"+refused+"/submit",Map.of("version",2),true).statusCode());
  } finally {
   if(space!=null) {
    jdbc.update("DELETE FROM validation_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
    jdbc.update("DELETE FROM soumission_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
    jdbc.update("DELETE FROM projet WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",space);
    jdbc.update("DELETE FROM groupe WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
   }
   for(long u:users) {jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",u);jdbc.update("DELETE FROM utilisateur WHERE id=?",u);}
  }
 }

 @Test void publicationVisibilityWithdrawalAndPermissions() throws Exception {
  var author=new Session();var admin=new Session();var other=new Session();var anonymous=new Session();
  List<Long> users=new ArrayList<>();Long space=null;
  try {
   long uid=author.register();users.add(uid);long aid=admin.register();users.add(aid);long oid=other.register();users.add(oid);
   space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Publication test','ORGANISATEUR',?) RETURNING id",Long.class,aid);
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE'),(?,?,'ADMINISTRATEUR')",uid,space,aid,space);
   jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",oid);
   long group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,'Groupe privé') RETURNING id",Long.class,space);
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE')",uid,space,group);
   long id=jdbc.queryForObject("INSERT INTO projet(espace_id,auteur_id,titre,description,objectif,image_url) VALUES (?,?,'Projet public test','Description publique','Objectif public','https://example.com/public.jpg') RETURNING id",Long.class,space,uid);
   String path="/api/project-publications/"+id, publicPath="/api/projects/"+id;
   var publish=Map.of("version",0,"published",true);
   assertEquals(401,anonymous.post(path,publish,true).statusCode());
   assertEquals(403,admin.post(path,publish,false).statusCode());
   assertEquals(404,author.post(path,publish,true).statusCode());assertEquals(403,other.post(path,publish,true).statusCode());
   assertEquals(409,admin.post(path,publish,true).statusCode());
   assertEquals(404,anonymous.get(publicPath).statusCode());
   jdbc.update("UPDATE projet SET statut='APPROUVE' WHERE id=?",id);
   assertEquals(404,anonymous.get(publicPath).statusCode());
   jdbc.update("INSERT INTO validation_projet(projet_id,examinateur_id,decision,commentaire) VALUES (?,?,'APPROUVE','Remarque strictement privée')",id,aid);
   assertEquals(1,json.readTree(admin.get("/api/project-publications").body()).size());
   var activePage=json.readTree(admin.get("/api/project-publications/paged?mode=ACTIVE&spaceId="+space+"&page=0").body());
   assertEquals(1,activePage.get("total").asInt());
   assertEquals(1,activePage.get("items").size());
   assertEquals(200,admin.post(path,publish,true).statusCode());
   assertEquals(200,admin.post(path,publish,true).statusCode());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM publication_projet WHERE projet_id=?",Integer.class,id));
   var publicView=anonymous.get(publicPath);assertEquals(200,publicView.statusCode());assertTrue(publicView.headers().firstValue("Cache-Control").orElse("").contains("no-store"));
   assertEquals("https://example.com/public.jpg",json.readTree(publicView.body()).get("imageUrl").asText());
   assertFalse(publicView.body().contains("Remarque strictement privée"));assertFalse(publicView.body().contains("reviews"));assertFalse(publicView.body().contains("email"));
   assertTrue(anonymous.get("/api/projects").body().contains("Projet public test"));
   assertEquals(409,admin.post(path,Map.of("version",0,"published",false),true).statusCode());
   var withdraw=Map.of("version",1,"published",false);
   var first=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return admin.post(path,withdraw,true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   var second=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return admin.post(path,Map.of("version",1,"published",true),true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   assertEquals(Set.of(200,409),Set.of(first.get(),second.get()));
   // Ensure withdrawal regardless of which concurrent action won.
   long version=jdbc.queryForObject("SELECT version FROM projet WHERE id=?",Long.class,id);
   assertEquals(200,admin.post(path,Map.of("version",version,"published",false),true).statusCode());
   assertEquals(404,anonymous.get(publicPath).statusCode());assertFalse(anonymous.get("/api/projects").body().contains("Projet public test"));
   assertEquals("APPROUVE",jdbc.queryForObject("SELECT statut FROM projet WHERE id=?",String.class,id));
   long finishVersion=jdbc.queryForObject("SELECT version FROM projet WHERE id=?",Long.class,id);
   assertEquals(404,author.post(path+"/finish",Map.of("version",finishVersion),true).statusCode());
   assertEquals(200,admin.post(path+"/finish",Map.of("version",finishVersion),true).statusCode());
   assertEquals(404,anonymous.get(publicPath).statusCode());
   assertEquals(409,admin.post(path,Map.of("version",finishVersion+1,"published",true),true).statusCode());
   assertTrue(Boolean.TRUE.equals(jdbc.queryForObject("SELECT termine_le IS NOT NULL FROM projet WHERE id=?",Boolean.class,id)));
   var historyPage=json.readTree(admin.get("/api/project-publications/paged?mode=HISTORY&spaceId="+space+"&page=0").body());
   assertEquals(1,historyPage.get("total").asInt());
   assertEquals(0,json.readTree(admin.get("/api/project-publications/paged?mode=ACTIVE&spaceId="+space+"&page=0").body()).get("total").asInt());
   long restricted=jdbc.queryForObject("INSERT INTO projet(espace_id,groupe_id,auteur_id,titre,description,objectif,statut,visibilite) VALUES (?,?,?,'Projet réservé test','Contenu réservé','Objectif privé','APPROUVE','GROUPE') RETURNING id",Long.class,space,group,uid);
   String privatePath="/api/projects/"+restricted, managePath="/api/project-publications/"+restricted;
   assertEquals(200,admin.post(managePath,publish,true).statusCode());
   assertEquals(404,anonymous.get(privatePath).statusCode());assertEquals(404,other.get(privatePath).statusCode());assertEquals(404,admin.get(privatePath).statusCode());
   assertFalse(anonymous.get("/api/projects").body().contains("Contenu réservé"));
   assertEquals(200,author.get(privatePath).statusCode());
   jdbc.update("UPDATE appartenance_groupe SET statut='RETIRE' WHERE utilisateur_id=?",uid);
   assertEquals(404,author.get(privatePath).statusCode());
   jdbc.update("UPDATE appartenance_groupe SET statut='ACTIF' WHERE utilisateur_id=?",uid);
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",uid);
   assertEquals(401,author.get(privatePath).statusCode());
   jdbc.update("UPDATE utilisateur SET statut='ACTIF' WHERE id=?",uid);
   jdbc.update("UPDATE espace_organisateur SET statut='SUSPENDU' WHERE id=?",space);
   assertEquals(404,author.get(privatePath).statusCode());
   assertEquals(409,admin.post(managePath,Map.of("version",1,"published",true),true).statusCode());
   assertEquals(200,admin.post(managePath,Map.of("version",1,"published",false),true).statusCode());
   jdbc.update("UPDATE espace_organisateur SET statut='ACTIF' WHERE id=?",space);
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=?",aid);
   assertEquals(404,admin.post(managePath,Map.of("version",2,"published",true),true).statusCode());
  } finally {
   if(space!=null) {
    jdbc.update("DELETE FROM publication_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
    jdbc.update("DELETE FROM validation_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
    jdbc.update("DELETE FROM projet WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",space);
    jdbc.update("DELETE FROM groupe WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
   }
   for(long u:users) {jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",u);jdbc.update("DELETE FROM utilisateur WHERE id=?",u);}
  }
 }

 @Test void projectHelpLifecyclePrivacyAndRetries() throws Exception {
  var member=new Session();var admin=new Session();var outsider=new Session();var anonymous=new Session();
  List<Long> users=new ArrayList<>();Long space=null;
  try {
   long uid=member.register();users.add(uid);long aid=admin.register();users.add(aid);long oid=outsider.register();users.add(oid);
   space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Aides test','ORGANISATEUR',?) RETURNING id",Long.class,aid);
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",aid,space);
   jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",oid);
   long project=jdbc.queryForObject("INSERT INTO projet(espace_id,auteur_id,titre,description,objectif,statut,publie) VALUES (?,?,'Projet entraide public','Description','Objectif','APPROUVE',true) RETURNING id",Long.class,space,aid);
   var body=Map.of("projectId",project,"requestId",UUID.randomUUID(),"type","BENEVOLAT","message","Je peux aider le samedi.");
   String root="/api/project-participations";
   assertEquals(401,anonymous.post(root,body,true).statusCode());assertEquals(403,member.post(root,body,false).statusCode());
   assertEquals(400,member.post(root,Map.of("projectId",project,"requestId",UUID.randomUUID(),"type","PAIEMENT"),true).statusCode());
   jdbc.update("UPDATE projet SET types_aide=ARRAY['BENEVOLAT'] WHERE id=?",project);
   assertEquals(1,json.readTree(anonymous.get("/api/projects/"+project).body()).get("helpTypes").size());
   assertEquals(409,member.post(root,Map.of("projectId",project,"requestId",UUID.randomUUID(),"type","COMPETENCES"),true).statusCode());
   jdbc.update("UPDATE projet SET types_aide=ARRAY['BENEVOLAT','COMPETENCES','PARTAGE','SOUTIEN_MORAL'] WHERE id=?",project);
   var one=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return member.post(root,body,true);}catch(Exception e){throw new RuntimeException(e);}});
   var two=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return member.post(root,body,true);}catch(Exception e){throw new RuntimeException(e);}});
   var first=one.get();var second=two.get();assertEquals(200,first.statusCode(),first.body());assertEquals(200,second.statusCode(),second.body());
   long id=json.readTree(first.body()).get("id").asLong();assertEquals(id,json.readTree(second.body()).get("id").asLong());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM participation_projet WHERE projet_id=?",Integer.class,project));
   assertEquals(409,member.post(root,Map.of("projectId",project,"requestId",UUID.randomUUID(),"type","BENEVOLAT"),true).statusCode());
   assertEquals(0,json.readTree(outsider.get(root).body()).size());assertEquals(0,json.readTree(outsider.get(root+"/received").body()).size());
   assertEquals(1,json.readTree(admin.get(root+"/received").body()).size());
   assertFalse(anonymous.get("/api/projects/"+project).body().contains("samedi"));
   String decision=root+"/"+id+"/decision",cancel=root+"/"+id+"/cancel";
   var accepted=Map.of("version",0,"status","ACCEPTEE","reason","Merci pour votre aide.");
   assertEquals(403,outsider.post(decision,accepted,true).statusCode());assertEquals(404,member.post(decision,accepted,true).statusCode());
   assertEquals(403,admin.post(decision,accepted,false).statusCode());
   assertEquals(400,admin.post(decision,Map.of("version",0,"status","REFUSEE","reason","  "),true).statusCode());
   assertEquals(200,admin.post(decision,accepted,true).statusCode());assertEquals(200,admin.post(decision,accepted,true).statusCode());
   assertEquals("ACCEPTEE",json.readTree(member.get(root).body()).get(0).get("status").asText());
   assertEquals(403,outsider.post(cancel,Map.of("version",1),true).statusCode());
   assertEquals(409,member.post(cancel,Map.of("version",0),true).statusCode());
   jdbc.update("UPDATE projet SET publie=false WHERE id=?",project);
   assertEquals(200,member.post(cancel,Map.of("version",1),true).statusCode());assertEquals(200,member.post(cancel,Map.of("version",1),true).statusCode());
   assertEquals("ANNULEE",json.readTree(member.post(root,body,true).body()).get("status").asText());
   assertEquals(3,jdbc.queryForObject("SELECT count(*) FROM historique_participation WHERE participation_id=?",Integer.class,id));
   assertEquals(404,member.post(root,Map.of("projectId",project,"requestId",UUID.randomUUID(),"type","COMPETENCES"),true).statusCode());
   jdbc.update("UPDATE projet SET publie=true WHERE id=?",project);
   var again=member.post(root,Map.of("projectId",project,"requestId",UUID.randomUUID(),"type","BENEVOLAT"),true);assertEquals(200,again.statusCode());
   long newId=json.readTree(again.body()).get("id").asLong();
   assertEquals(200,admin.post(root+"/"+newId+"/decision",Map.of("version",0,"status","REFUSEE","reason","L’équipe est complète."),true).statusCode());
   assertTrue(member.get(root).body().contains("L’équipe est complète."));
   assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM appartenance_espace WHERE utilisateur_id=?",Integer.class,uid));
   assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM appartenance_groupe WHERE utilisateur_id=?",Integer.class,uid));
   // Restricted project: membership is required both to propose and to accept.
   long group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,'Groupe aides') RETURNING id",Long.class,space);
   jdbc.update("UPDATE projet SET groupe_id=?,visibilite='GROUPE' WHERE id=?",group,project);
   var privateBody=Map.of("projectId",project,"requestId",UUID.randomUUID(),"type","COMPETENCES");
   assertEquals(404,member.post(root,privateBody,true).statusCode());
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE')",uid,space);
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'MEMBRE')",uid,space,group);
   var privateHelp=member.post(root,privateBody,true);assertEquals(200,privateHelp.statusCode(),privateHelp.body());
   long privateId=json.readTree(privateHelp.body()).get("id").asLong();
   jdbc.update("UPDATE appartenance_groupe SET statut='RETIRE' WHERE utilisateur_id=?",uid);
   assertEquals(409,admin.post(root+"/"+privateId+"/decision",accepted,true).statusCode());
   assertEquals(200,member.post(root+"/"+privateId+"/cancel",Map.of("version",0),true).statusCode());
   jdbc.update("UPDATE appartenance_groupe SET statut='ACTIF' WHERE utilisateur_id=?",uid);
   long raceId=json.readTree(member.post(root,Map.of("projectId",project,"requestId",UUID.randomUUID(),"type","PARTAGE"),true).body()).get("id").asLong();
   var acceptRace=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return admin.post(root+"/"+raceId+"/decision",accepted,true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   var cancelRace=java.util.concurrent.CompletableFuture.supplyAsync(()->{try{return member.post(root+"/"+raceId+"/cancel",Map.of("version",0),true).statusCode();}catch(Exception e){throw new RuntimeException(e);}});
   assertEquals(Set.of(200,409),Set.of(acceptRace.get(),cancelRace.get()));
   assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM historique_participation WHERE participation_id=?",Integer.class,raceId));
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=?",aid);
   assertEquals(0,json.readTree(admin.get(root+"/received").body()).size());
   assertEquals(404,admin.post(decision,accepted,true).statusCode());
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",uid);
   assertEquals(401,member.get(root).statusCode());assertEquals(401,member.post(root,body,true).statusCode());
  } finally {
   if(space!=null) {
    jdbc.update("DELETE FROM historique_participation WHERE participation_id IN (SELECT pp.id FROM participation_projet pp JOIN projet p ON p.id=pp.projet_id WHERE p.espace_id=?)",space);
    jdbc.update("DELETE FROM participation_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
    jdbc.update("DELETE FROM projet WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",space);
    jdbc.update("DELETE FROM groupe WHERE espace_id=?",space);jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
   }
   for(long u:users) {jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",u);jdbc.update("DELETE FROM utilisateur WHERE id=?",u);}
  }
 }

}
