package be.belconnect.backend;

import java.net.*;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class SpaceManagementApiTests {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 @Autowired be.belconnect.backend.auth.AuthController authController;
 // Each scenario creates several independent accounts on localhost. Isolate the in-memory
 // limiter between scenarios; production limits and authentication tests remain unchanged.
 @org.junit.jupiter.api.BeforeEach @org.junit.jupiter.api.AfterEach
 void resetTestAttemptWindow() {
  ((Map<?,?>)org.springframework.test.util.ReflectionTestUtils.getField(authController,"attempts")).clear();
 }
 final ObjectMapper json=new ObjectMapper();
 final List<Long> users=new ArrayList<>();
 class Actor {
  long id;
  final HttpClient client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
  HttpResponse<String> get(String path) throws Exception {
   return client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).GET().build(),HttpResponse.BodyHandlers.ofString());
  }
  HttpResponse<String> post(String path,Object body,boolean csrf) throws Exception {
   var req=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Content-Type","application/json");
   if(csrf) { var t=json.readTree(get("/api/auth/csrf").body()); req.header(t.get("headerName").asText(),t.get("token").asText()); }
   return client.send(req.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
  }
 }
 Actor actor() throws Exception {
  var a=new Actor(); var response=a.post("/api/auth/register",Map.of("firstName","Camille","lastName","Gestion","email","management-"+UUID.randomUUID()+"@example.com","password","Test-only-"+UUID.randomUUID()),true);
  assertEquals(201,response.statusCode(),response.body()); a.id=json.readTree(response.body()).get("id").asLong(); users.add(a.id); a.get("/api/auth/csrf"); return a;
 }
 JsonNode ok(HttpResponse<String> r,int status) throws Exception { assertEquals(status,r.statusCode(),r.body()); return json.readTree(r.body()); }
 Map<String,Object> sc(String name) { return Map.of("name",name,"type","ORGANISATEUR","description","Une communauté locale"); }
 Map<String,Object> gc(String name) { return Map.of("name",name,"description","Rencontres et projets","coverUrl","","openMembership",false,"visibility","PRIVEE"); }
 JsonNode request(Actor a,String name) throws Exception { return ok(a.post("/api/workspace/requests",Map.of("requestId",UUID.randomUUID(),"content",sc(name)),true),201); }
 void owner(Actor a) { jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",a.id); }
 void cleanup() {
  for(long user:users) for(long space:jdbc.queryForList("SELECT id FROM espace_organisateur WHERE createur_id=?",Long.class,user)) {
   jdbc.update("DELETE FROM demande_adhesion_groupe WHERE espace_id=?",space);
   jdbc.update("DELETE FROM historique_gestion_espace WHERE espace_id=?",space);
   jdbc.update("DELETE FROM soumission_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM projet WHERE espace_id=?",space);
   jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",space);
   jdbc.update("DELETE FROM groupe WHERE espace_id=?",space);
   jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);
   jdbc.update("DELETE FROM demande_espace WHERE espace_id=?",space);
   jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
  }
  for(long user:users) { jdbc.update("DELETE FROM demande_espace WHERE demandeur_id=? OR examinateur_id=?",user,user); jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",user); }
  for(long user:users) jdbc.update("DELETE FROM utilisateur WHERE id=?",user);
 }
 @Test void approvalGroupsIsolationValidationAndRevocation() throws Exception {
  try {
   var admin=actor(); var outsider=actor(); var platform=actor(); owner(platform);
   assertEquals(401,new Actor().get("/api/workspace/requests").statusCode());
   var body=Map.of("requestId",UUID.randomUUID(),"content",sc("Espace du quartier"));
   assertEquals(403,admin.post("/api/workspace/requests",body,false).statusCode());
   long request=ok(admin.post("/api/workspace/requests",body,true),201).get("id").asLong();
   assertEquals(request,ok(admin.post("/api/workspace/requests",body,true),201).get("id").asLong());
   assertEquals(0,ok(admin.get("/api/workspace"),200).get("spaces").size());
   assertEquals(0,ok(outsider.get("/api/workspace/requests"),200).size());
   assertEquals(403,admin.get("/api/workspace/opening-requests").statusCode());
   var approval=Map.of("version",0,"status","APPROUVEE","reason","");
   assertEquals(403,admin.post("/api/workspace/opening-requests/"+request+"/decision",approval,true).statusCode());
   long space=ok(platform.post("/api/workspace/opening-requests/"+request+"/decision",approval,true),200).get("spaceId").asLong();
   String path="/api/workspace/spaces/"+space;
   assertEquals(space,ok(platform.post("/api/workspace/opening-requests/"+request+"/decision",approval,true),200).get("spaceId").asLong());
   assertEquals("ADMINISTRATEUR",ok(admin.get("/api/workspace"),200).get("spaces").get(0).get("role").asText());
   assertFalse(ok(admin.get("/api/workspace"),200).get("owner").asBoolean());
   assertEquals(403,platform.get(path+"/management").statusCode());
   assertEquals(403,outsider.get(path+"/management").statusCode());
   var creation=Map.of("requestId",UUID.randomUUID(),"content",gc("Jardin partagé"));
   assertEquals(403,admin.post(path+"/groups",creation,false).statusCode());
   assertEquals(403,outsider.post(path+"/groups",creation,true).statusCode());
   long group=ok(admin.post(path+"/groups",creation,true),201).get("id").asLong();
   assertEquals(group,ok(admin.post(path+"/groups",creation,true),201).get("id").asLong());
   assertEquals(1,ok(admin.get(path+"/management"),200).get("groups").size());
   assertEquals(group,ok(admin.get("/api/workspace"),200).get("groups").get(0).get("id").asLong());
   assertEquals(409,admin.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",gc("Jardin partagé")),true).statusCode());
   var invalid=new HashMap<>(gc("Couverture")); invalid.put("coverUrl","javascript:alert(1)");
   assertEquals(400,admin.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",invalid),true).statusCode());
   assertEquals(400,admin.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",gc("  ")),true).statusCode());
   var edit=Map.of("version",0,"content",gc("Jardin des voisins"));
   ok(admin.post(path+"/groups/"+group,edit,true),200);
   assertEquals(409,admin.post(path+"/groups/"+group,edit,true).statusCode());
   assertEquals("Jardin des voisins",ok(admin.get(path+"/management"),200).get("groups").get(0).get("name").asText());
   long otherRequest=request(outsider,"Autre espace").get("id").asLong();
   long otherSpace=ok(platform.post("/api/workspace/opening-requests/"+otherRequest+"/decision",approval,true),200).get("spaceId").asLong();
   assertEquals(403,outsider.post(path+"/groups/"+group,Map.of("version",1,"content",gc("Intrusion")),true).statusCode());
   assertEquals(404,outsider.post("/api/workspace/spaces/"+otherSpace+"/groups/"+group,edit,true).statusCode());
   ok(admin.post(path,Map.of("version",0,"content",sc("Nouveau nom")),true),200);
   assertEquals(409,admin.post(path,Map.of("version",0,"content",sc("Écrasement")),true).statusCode());
   // A direct administrator authors in a group without a fictitious group membership.
   ok(admin.post("/api/project-drafts",Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",Map.of("title","Projet de quartier","description","Une idée collective","objective","Rassembler les voisins")),true),201);
   assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM appartenance_groupe WHERE groupe_id=?",Integer.class,group));
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE')",outsider.id,space);
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'REFERENT')",outsider.id,space,group);
   assertEquals(403,outsider.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",gc("Interdit")),true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=? AND espace_id=?",admin.id,space);
   assertEquals(403,admin.get(path+"/management").statusCode());
   assertEquals(403,admin.post(path+"/groups",creation,true).statusCode());
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",admin.id);
   assertEquals(401,admin.get("/api/workspace/requests").statusCode());
   assertEquals(4,jdbc.queryForObject("SELECT count(*) FROM historique_gestion_espace WHERE espace_id=?",Integer.class,space));
  } finally { cleanup(); }
 }
 @Test void concurrentApprovalAndEditsRefusalAndInactiveApplicant() throws Exception {
  try {
   var applicant=actor(); var platform=actor(); owner(platform);
   long id=request(applicant,"Communauté locale").get("id").asLong();
   String decisionPath="/api/workspace/opening-requests/"+id+"/decision";
   var approve=Map.of("version",0,"status","APPROUVEE","reason","");
   try(var pool=Executors.newFixedThreadPool(2)) {
    var start=new CountDownLatch(1);
    var a=pool.submit(()->{start.await(); return platform.post(decisionPath,approve,true);});
    var b=pool.submit(()->{start.await(); return platform.post(decisionPath,approve,true);}); start.countDown();
    long space=ok(a.get(20,TimeUnit.SECONDS),200).get("spaceId").asLong();
    assertEquals(space,ok(b.get(20,TimeUnit.SECONDS),200).get("spaceId").asLong());
    assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM espace_organisateur WHERE createur_id=?",Integer.class,applicant.id));
    String path="/api/workspace/spaces/"+space;
    var creation=Map.of("requestId",UUID.randomUUID(),"content",gc("Groupe initial"));
    var first=pool.submit(()->applicant.post(path+"/groups",creation,true));
    var second=pool.submit(()->applicant.post(path+"/groups",creation,true));
    long group=ok(first.get(20,TimeUnit.SECONDS),201).get("id").asLong();
    assertEquals(group,ok(second.get(20,TimeUnit.SECONDS),201).get("id").asLong());
    var x=pool.submit(()->applicant.post(path+"/groups/"+group,Map.of("version",0,"content",gc("Version un")),true));
    var y=pool.submit(()->applicant.post(path+"/groups/"+group,Map.of("version",0,"content",gc("Version deux")),true));
    assertEquals(Set.of(200,409),new HashSet<>(List.of(x.get(20,TimeUnit.SECONDS).statusCode(),y.get(20,TimeUnit.SECONDS).statusCode())));
    jdbc.update("UPDATE espace_organisateur SET statut='SUSPENDU' WHERE id=?",space);
    assertEquals(403,applicant.post(path+"/groups",creation,true).statusCode());
   }
   long refused=request(applicant,"Demande à refuser").get("id").asLong(); String refusalPath="/api/workspace/opening-requests/"+refused+"/decision";
   assertEquals(400,platform.post(refusalPath,Map.of("version",0,"status","REFUSEE","reason","  "),true).statusCode());
   ok(platform.post(refusalPath,Map.of("version",0,"status","REFUSEE","reason","Merci de préciser votre organisation."),true),200);
   assertEquals("REFUSEE",ok(applicant.get("/api/workspace/requests"),200).get(0).get("status").asText());
   long pending=request(applicant,"Compte suspendu").get("id").asLong(); jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",applicant.id);
   assertEquals(409,platform.post("/api/workspace/opening-requests/"+pending+"/decision",approve,true).statusCode());
   jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",platform.id);
   assertEquals(403,platform.get("/api/workspace/opening-requests").statusCode());
  } finally { cleanup(); }
 }
 long setupSpace(Actor admin) {
  long id=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Espace test adhésions','ORGANISATEUR',?) RETURNING id",Long.class,admin.id);
  jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",admin.id,id); return id;
 }
 long setupGroup(long space,String name,boolean open,String visibility) {
  return jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,adhesion_ouverte,visibilite) VALUES (?,?,?,?) RETURNING id",Long.class,space,name,open,visibility);
 }
 @Test void membershipsPublicPrivateApprovalAndIsolation() throws Exception {
  try {
   var admin=actor();var member=actor();var other=actor();var platform=actor();owner(platform);
   long space=setupSpace(admin), otherSpace=setupSpace(other);
   long open=setupGroup(space,"Groupe ouvert",true,"PUBLIQUE"),closed=setupGroup(space,"Sur demande",false,"PUBLIQUE"),secret=setupGroup(space,"Confidentiel",true,"PRIVEE");
   var visitor=new Actor();String catalogue=ok(visitor.get("/api/groups"),200).toString();
   assertTrue(catalogue.contains("Groupe ouvert"));assertFalse(catalogue.contains("Confidentiel"));assertFalse(catalogue.contains("applicant"));
   assertEquals(403,member.post("/api/groups/"+open+"/join",Map.of(),false).statusCode());
   assertEquals(404,member.post("/api/groups/"+secret+"/join",Map.of(),true).statusCode());
   long req=ok(member.post("/api/groups/"+closed+"/join",Map.of(),true),200).get("id").asLong();
   assertEquals(req,ok(member.post("/api/groups/"+closed+"/join",Map.of(),true),200).get("id").asLong());
   assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM appartenance_espace WHERE utilisateur_id=?",Integer.class,member.id));
   assertEquals(0,ok(other.get("/api/group-memberships"),200).size());
   assertEquals(0,ok(other.get("/api/group-memberships/received"),200).size());
   assertEquals(0,ok(platform.get("/api/group-memberships/received"),200).size());
   assertEquals(1,ok(admin.get("/api/group-memberships/received"),200).size());
   var accept=Map.of("version",0,"status","ACCEPTEE","reason","");String decision="/api/group-memberships/"+req+"/decision";
   assertEquals(403,other.post(decision,accept,true).statusCode());assertEquals(403,platform.post(decision,accept,true).statusCode());
   assertEquals(403,admin.post(decision,accept,false).statusCode());
   assertEquals("ACCEPTEE",ok(admin.post(decision,accept,true),200).get("status").asText());
   ok(admin.post(decision,accept,true),200);
   assertEquals("MEMBRE",jdbc.queryForObject("SELECT role FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?",String.class,member.id,space));
   assertEquals("MEMBRE",jdbc.queryForObject("SELECT role FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",String.class,member.id,closed));
   assertEquals(1,ok(member.get("/api/workspace"),200).get("groups").size());
   assertTrue(ok(member.get("/api/groups"),200).toString().contains("Confidentiel"));
   assertEquals("ACCEPTEE",ok(member.post("/api/groups/"+secret+"/join",Map.of(),true),200).get("status").asText());
   // Joining a public open group creates both memberships, without granting any elevated role.
   assertEquals("MEMBRE",ok(other.post("/api/groups/"+open+"/join",Map.of(),true),200).get("membershipStatus").asText());
   assertEquals("ADMINISTRATEUR",jdbc.queryForObject("SELECT role FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?",String.class,other.id,otherSpace));
   assertEquals("MEMBRE",jdbc.queryForObject("SELECT role FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?",String.class,other.id,space));
   // Existing referent roles are preserved, never overwritten by a repeated join.
   jdbc.update("UPDATE appartenance_groupe SET role='REFERENT' WHERE utilisateur_id=? AND groupe_id=?",other.id,open);
   ok(other.post("/api/groups/"+open+"/join",Map.of(),true),200);
   assertEquals("REFERENT",jdbc.queryForObject("SELECT role FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",String.class,other.id,open));
   jdbc.update("UPDATE appartenance_groupe SET statut='RETIRE' WHERE utilisateur_id=? AND groupe_id=?",other.id,open);
   assertEquals(403,other.post("/api/groups/"+open+"/join",Map.of(),true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='SUSPENDU' WHERE utilisateur_id=? AND espace_id=?",member.id,space);
   assertEquals(403,member.post("/api/groups/"+open+"/join",Map.of(),true).statusCode());
   assertFalse(ok(member.get("/api/groups"),200).toString().contains("Confidentiel"));
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",member.id);
   assertEquals(401,member.get("/api/group-memberships").statusCode());
  } finally { cleanup(); }
 }
 @Test void membershipConcurrencyRefusalAndInactiveGroups() throws Exception {
  try {
   var admin=actor();var member=actor();long space=setupSpace(admin);
   long open=setupGroup(space,"Ouvert concurrent",true,"PUBLIQUE"),closed=setupGroup(space,"Demande concurrente",false,"PUBLIQUE");
   try(var pool=Executors.newFixedThreadPool(2)) {
    var a=pool.submit(()->member.post("/api/groups/"+open+"/join",Map.of(),true));
    var b=pool.submit(()->member.post("/api/groups/"+open+"/join",Map.of(),true));
    assertEquals(ok(a.get(20,TimeUnit.SECONDS),200).get("id").asLong(),ok(b.get(20,TimeUnit.SECONDS),200).get("id").asLong());
    assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",Integer.class,member.id,open));
    long req=ok(member.post("/api/groups/"+closed+"/join",Map.of(),true),200).get("id").asLong();String path="/api/group-memberships/"+req+"/decision";
    assertEquals(400,admin.post(path,Map.of("version",0,"status","REFUSEE","reason"," "),true).statusCode());
    assertEquals(409,admin.post(path,Map.of("version",5,"status","ACCEPTEE","reason",""),true).statusCode());
    var x=pool.submit(()->admin.post(path,Map.of("version",0,"status","ACCEPTEE","reason",""),true));
    var y=pool.submit(()->admin.post(path,Map.of("version",0,"status","REFUSEE","reason","Groupe complet"),true));
    assertEquals(Set.of(200,409),new HashSet<>(List.of(x.get(20,TimeUnit.SECONDS).statusCode(),y.get(20,TimeUnit.SECONDS).statusCode())));
    var status=jdbc.queryForObject("SELECT statut FROM demande_adhesion_groupe WHERE id=?",String.class,req);
    assertEquals(status.equals("ACCEPTEE")?1:0,jdbc.queryForObject("SELECT count(*) FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",Integer.class,member.id,closed));
   }
   long refusedGroup=setupGroup(space,"Refus explicite",false,"PUBLIQUE");long refusal=ok(member.post("/api/groups/"+refusedGroup+"/join",Map.of(),true),200).get("id").asLong();
   ok(admin.post("/api/group-memberships/"+refusal+"/decision",Map.of("version",0,"status","REFUSEE","reason","Merci de contacter l’organisation."),true),200);
   assertEquals("REFUSEE",ok(member.post("/api/groups/"+refusedGroup+"/join",Map.of(),true),200).get("status").asText());
   assertTrue(ok(member.get("/api/group-memberships"),200).toString().contains("Merci de contacter"));
   long archived=setupGroup(space,"Groupe archivé",false,"PUBLIQUE");long pending=ok(member.post("/api/groups/"+archived+"/join",Map.of(),true),200).get("id").asLong();
   jdbc.update("UPDATE groupe SET statut='ARCHIVE' WHERE id=?",archived);
   assertEquals(404,member.post("/api/groups/"+archived+"/join",Map.of(),true).statusCode());
   assertEquals(409,admin.post("/api/group-memberships/"+pending+"/decision",Map.of("version",0,"status","ACCEPTEE","reason",""),true).statusCode());
   assertFalse(ok(member.get("/api/groups"),200).toString().contains("Groupe archivé"));
   long inactive=setupGroup(space,"Compte inactif",false,"PUBLIQUE");long disabled=ok(member.post("/api/groups/"+inactive+"/join",Map.of(),true),200).get("id").asLong();
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",member.id);
   assertEquals(409,admin.post("/api/group-memberships/"+disabled+"/decision",Map.of("version",0,"status","ACCEPTEE","reason",""),true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=? AND espace_id=?",admin.id,space);
   assertEquals(403,admin.post("/api/group-memberships/"+disabled+"/decision",Map.of("version",0,"status","REFUSEE","reason","Refus"),true).statusCode());
  } finally { cleanup(); }
 }
 void addMember(Actor member,long space,long group,String role) {
  jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE') ON CONFLICT DO NOTHING",member.id,space);
  jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,?)",member.id,space,group,role);
 }
 @Test void referentDesignationRosterIsolationAndProjectAccess() throws Exception {
  try {
   var admin=actor();var ref=actor();var member=actor();var outsider=actor();var platform=actor();owner(platform);
   long space=setupSpace(admin),otherSpace=setupSpace(outsider);
   long group=setupGroup(space,"Groupe des référents",false,"PUBLIQUE"),otherGroup=setupGroup(otherSpace,"Autre communauté",false,"PUBLIQUE");
   addMember(ref,space,group,"MEMBRE");addMember(member,space,group,"MEMBRE");
   String path="/api/workspace/groups/"+group;
   assertEquals(401,new Actor().get(path+"/members").statusCode());
   assertEquals(403,member.get(path+"/members").statusCode());
   assertEquals(403,outsider.get(path+"/members").statusCode());
   assertEquals(403,platform.get(path+"/members").statusCode());
   var initial=ok(admin.get(path+"/members"),200);assertEquals(2,initial.get("members").size());assertFalse(initial.toString().contains("@example.com"));
   var promote=Map.of("version",0,"role","REFERENT");
   assertEquals(403,admin.post(path+"/members/"+ref.id+"/role",promote,false).statusCode());
   assertEquals(403,ref.post(path+"/members/"+ref.id+"/role",promote,true).statusCode());
   assertEquals(403,outsider.post(path+"/members/"+ref.id+"/role",promote,true).statusCode());
   assertEquals(404,admin.post(path+"/members/"+outsider.id+"/role",promote,true).statusCode());
   assertEquals(400,admin.post(path+"/members/"+ref.id+"/role",Map.of("version",0,"role","ADMINISTRATEUR"),true).statusCode());
   ok(admin.post(path+"/members/"+ref.id+"/role",promote,true),200);
   ok(admin.post(path+"/members/"+ref.id+"/role",promote,true),200);
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM historique_gestion_espace WHERE groupe_id=? AND action='REFERENT_DESIGNE'",Integer.class,group));
   var roster=ok(ref.get(path+"/members"),200);assertFalse(roster.get("canManageRoles").asBoolean());assertFalse(roster.get("canManageMemberships").asBoolean());
   assertEquals(403,ref.get("/api/workspace/groups/"+otherGroup+"/members").statusCode());
   assertEquals(403,ref.post(path+"/permissions",Map.of("version",0,"manageMemberships",true),true).statusCode());
   long project=jdbc.queryForObject("INSERT INTO projet(espace_id,groupe_id,auteur_id,titre,description,objectif,statut,etape_validation) VALUES (?,?,?,'Projet pour examen','Description','Objectif','SOUMIS','REFERENT') RETURNING id",Long.class,space,group,admin.id);
   assertEquals(1,ok(ref.get("/api/project-reviews"),200).size());
   assertEquals(404,ref.post("/api/project-reviews/"+project+"/decision",Map.of("version",0,"decision","APPROUVE","comment",""),true).statusCode());
   // Multiple referents are allowed, and removal keeps ordinary group membership.
   ok(admin.post(path+"/members/"+member.id+"/role",promote,true),200);
   ok(admin.post(path+"/members/"+ref.id+"/role",Map.of("version",1,"role","MEMBRE"),true),200);
   assertEquals(0,ok(ref.get("/api/project-reviews"),200).size());assertEquals(403,ref.get(path+"/members").statusCode());
   assertEquals("ACTIF",jdbc.queryForObject("SELECT statut FROM appartenance_groupe WHERE groupe_id=? AND utilisateur_id=?",String.class,group,ref.id));
   assertEquals("MEMBRE",jdbc.queryForObject("SELECT role FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=?",String.class,space,ref.id));
   assertEquals(409,admin.post(path+"/members/"+ref.id+"/role",promote,true).statusCode());
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",ref.id);
   assertEquals(404,admin.post(path+"/members/"+ref.id+"/role",Map.of("version",2,"role","REFERENT"),true).statusCode());
   assertEquals(1,ok(admin.get(path+"/members"),200).get("members").size());
  } finally { cleanup(); }
 }
 @Test void delegatedMembershipsAreScopedAndRevocable() throws Exception {
  try {
   var admin=actor();var ref=actor();var applicant=actor();long space=setupSpace(admin);
   long group=setupGroup(space,"Délégation active",false,"PUBLIQUE"),other=setupGroup(space,"Sans délégation",false,"PUBLIQUE");
   addMember(ref,space,group,"REFERENT");addMember(ref,space,other,"REFERENT");
   String path="/api/workspace/groups/"+group;
   long req=ok(applicant.post("/api/groups/"+group+"/join",Map.of(),true),200).get("id").asLong();
   long otherReq=ok(applicant.post("/api/groups/"+other+"/join",Map.of(),true),200).get("id").asLong();
   var accept=Map.of("version",0,"status","ACCEPTEE","reason","");
   assertEquals(0,ok(ref.get("/api/group-memberships/received"),200).size());
   assertEquals(403,ref.post("/api/group-memberships/"+req+"/decision",accept,true).statusCode());
   assertEquals(403,admin.post(path+"/permissions",Map.of("version",0,"manageMemberships",true),false).statusCode());
   ok(admin.post(path+"/permissions",Map.of("version",0,"manageMemberships",true),true),200);
   assertEquals(409,admin.post(path+"/permissions",Map.of("version",0,"manageMemberships",false),true).statusCode());
   assertEquals(1,ok(ref.get("/api/group-memberships/received"),200).size());
   assertTrue(ok(ref.get(path+"/members"),200).get("canManageMemberships").asBoolean());
   assertTrue(ok(ref.get("/api/workspace"),200).get("groups").toString().contains("\"canManageMemberships\":true"));
   assertEquals(403,ref.post("/api/group-memberships/"+otherReq+"/decision",accept,true).statusCode());
   ok(ref.post("/api/group-memberships/"+req+"/decision",accept,true),200);
   ok(admin.post(path+"/permissions",Map.of("version",1,"manageMemberships",false),true),200);
   assertEquals(0,ok(ref.get("/api/group-memberships/received"),200).size());
   assertEquals(403,ref.post("/api/group-memberships/"+req+"/decision",accept,true).statusCode());
   // The administrator retains direct control when delegation is disabled.
   ok(admin.post("/api/group-memberships/"+otherReq+"/decision",accept,true),200);
   ok(admin.post(path+"/permissions",Map.of("version",2,"manageMemberships",true),true),200);
   jdbc.update("UPDATE appartenance_groupe SET statut='SUSPENDU' WHERE utilisateur_id=? AND groupe_id=?",ref.id,group);
   assertEquals(403,ref.get(path+"/members").statusCode());
   assertEquals(0,ok(ref.get("/api/group-memberships/received"),200).size());
   jdbc.update("UPDATE appartenance_groupe SET statut='ACTIF' WHERE utilisateur_id=? AND groupe_id=?",ref.id,group);
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=? AND espace_id=?",ref.id,space);
   assertEquals(403,ref.get(path+"/members").statusCode());
   assertEquals(403,ref.post("/api/group-memberships/"+req+"/decision",accept,true).statusCode());
   jdbc.update("UPDATE groupe SET statut='ARCHIVE' WHERE id=?",group);
   assertEquals(403,admin.post(path+"/permissions",Map.of("version",3,"manageMemberships",false),true).statusCode());
  } finally { cleanup(); }
 }
 @Test void delegationRevocationSerializesWithDecisions() throws Exception {
  try {
   var admin=actor();var ref=actor();var applicant=actor();long space=setupSpace(admin);
   long group=setupGroup(space,"Concurrence délégation",false,"PUBLIQUE");addMember(ref,space,group,"REFERENT");
   String permissions="/api/workspace/groups/"+group+"/permissions";
   ok(admin.post(permissions,Map.of("version",0,"manageMemberships",true),true),200);
   long req=ok(applicant.post("/api/groups/"+group+"/join",Map.of(),true),200).get("id").asLong();String decision="/api/group-memberships/"+req+"/decision";
   var accept=Map.of("version",0,"status","ACCEPTEE","reason","");
   try(var pool=Executors.newFixedThreadPool(2)) {
    var start=new CountDownLatch(1);
    var revoke=pool.submit(()->{start.await();return admin.post(permissions,Map.of("version",1,"manageMemberships",false),true);});
    var decide=pool.submit(()->{start.await();return ref.post(decision,accept,true);});start.countDown();
    ok(revoke.get(20,TimeUnit.SECONDS),200);int status=decide.get(20,TimeUnit.SECONDS).statusCode();assertTrue(status==200 || status==403);
    assertEquals(status==200?1:0,jdbc.queryForObject("SELECT count(*) FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",Integer.class,applicant.id,group));
   }
   assertEquals(403,ref.post(decision,accept,true).statusCode());
   assertEquals(0,ok(ref.get("/api/group-memberships/received"),200).size());
  } finally { cleanup(); }
 }
}
