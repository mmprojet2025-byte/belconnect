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
@org.springframework.test.context.TestPropertySource(properties="STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_test_subscription_local")
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
 @Test void starterAndProLimitGroupsPerSpaceWithoutRemovingExistingGroups() throws Exception {
  try {
   var admin=actor(); long space=setupSpace(admin);
   String path="/api/workspace/spaces/"+space;
   assertEquals(3,ok(admin.get(path+"/management"),200).get("groupQuota").get("max").asInt());
   var first=Map.of("requestId",UUID.randomUUID(),"content",gc("Groupe un"));
   long firstId=ok(admin.post(path+"/groups",first,true),201).get("id").asLong();
   for(int i=2;i<=3;i++) ok(admin.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",gc("Groupe "+i)),true),201);
   assertEquals(3,ok(admin.get(path+"/management"),200).get("groupQuota").get("used").asInt());
   assertEquals(409,admin.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",gc("Groupe quatre")),true).statusCode());
   assertEquals(firstId,ok(admin.post(path+"/groups",first,true),201).get("id").asLong());
   jdbc.update("INSERT INTO abonnement_espace(espace_id,administrateur_id,formule,statut) VALUES (?,?,'PRO','ACTIF')",space,admin.id);
   assertEquals(6,ok(admin.get(path+"/management"),200).get("groupQuota").get("max").asInt());
   for(int i=4;i<=6;i++) ok(admin.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",gc("Groupe "+i)),true),201);
   assertEquals(409,admin.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",gc("Groupe sept")),true).statusCode());
   jdbc.update("UPDATE abonnement_espace SET formule='STARTER',statut='ANNULE' WHERE espace_id=?",space);
   assertEquals(6,ok(admin.get(path+"/management"),200).get("groupQuota").get("used").asInt());
   assertEquals(3,ok(admin.get(path+"/management"),200).get("groupQuota").get("max").asInt());
   assertEquals(409,admin.post(path+"/groups",Map.of("requestId",UUID.randomUUID(),"content",gc("Encore un")),true).statusCode());
   ok(admin.post(path+"/groups/"+firstId+"/status",Map.of("version",0,"status","ARCHIVE"),true),200);
   assertEquals(5,ok(admin.get(path+"/management"),200).get("groupQuota").get("used").asInt());
  } finally { cleanup(); }
 }
 JsonNode request(Actor a,String name) throws Exception { return ok(a.post("/api/workspace/requests",Map.of("requestId",UUID.randomUUID(),"content",sc(name)),true),201); }
 @Test void starterAndProLimitOrganiserSpaceRequests() throws Exception {
  try {
   var applicant=actor(); var proprietor=actor(); owner(proprietor);
   String quotaPath="/api/workspace/requests/quota";
   assertEquals(1,ok(applicant.get(quotaPath),200).get("max").asInt());
   var firstBody=Map.of("requestId",UUID.randomUUID(),"content",sc("Premier espace"));
   long first=ok(applicant.post("/api/workspace/requests",firstBody,true),201).get("id").asLong();
   assertEquals(first,ok(applicant.post("/api/workspace/requests",firstBody,true),201).get("id").asLong());
   assertEquals(409,applicant.post("/api/workspace/requests",Map.of("requestId",UUID.randomUUID(),"content",sc("Deuxième espace")),true).statusCode());
   long firstSpace=ok(proprietor.post("/api/workspace/opening-requests/"+first+"/decision",Map.of("version",0,"status","APPROUVEE","reason",""),true),200).get("spaceId").asLong();
   assertEquals(1,ok(applicant.get(quotaPath),200).get("used").asInt());
   assertEquals(409,applicant.post("/api/workspace/requests",Map.of("requestId",UUID.randomUUID(),"content",sc("Deuxième espace")),true).statusCode());
   jdbc.update("INSERT INTO abonnement_espace(espace_id,administrateur_id,formule,statut) VALUES (?,?,'PRO','ACTIF')",firstSpace,applicant.id);
   assertEquals(3,ok(applicant.get(quotaPath),200).get("max").asInt());
   long second=request(applicant,"Deuxième espace").get("id").asLong();
   long third=request(applicant,"Troisième espace").get("id").asLong();
   assertEquals(3,ok(applicant.get(quotaPath),200).get("used").asInt());
   assertEquals(409,applicant.post("/api/workspace/requests",Map.of("requestId",UUID.randomUUID(),"content",sc("Quatrième espace")),true).statusCode());
   jdbc.update("UPDATE abonnement_espace SET formule='STARTER',statut='ANNULE' WHERE espace_id=?",firstSpace);
   assertEquals(409,proprietor.post("/api/workspace/opening-requests/"+second+"/decision",Map.of("version",0,"status","APPROUVEE","reason",""),true).statusCode());
   jdbc.update("UPDATE abonnement_espace SET formule='PRO',statut='ACTIF' WHERE espace_id=?",firstSpace);
   for(long id:List.of(second,third)) ok(proprietor.post("/api/workspace/opening-requests/"+id+"/decision",Map.of("version",0,"status","APPROUVEE","reason",""),true),200);
   assertEquals(3,jdbc.queryForObject("SELECT count(*) FROM espace_organisateur WHERE createur_id=?",Integer.class,applicant.id));
  } finally { cleanup(); }
 }
 void owner(Actor a) { jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",a.id); }
 @Test void administratorOnlySeesOwnSpaceInvoicesAndMemberRoles() throws Exception {
  try {
   var first=actor(); var second=actor(); var outsider=actor();
   long firstSpace=setupSpace(first); setupSpace(second);
   long group=setupGroup(firstSpace,"Groupe rôles test",false,"PRIVEE");
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE')",outsider.id,firstSpace);
   jdbc.update("INSERT INTO appartenance_groupe(utilisateur_id,espace_id,groupe_id,role) VALUES (?,?,?,'REFERENT')",outsider.id,firstSpace,group);
   String membersPath="/api/workspace/spaces/"+firstSpace+"/members";
   String invoicesPath="/api/workspace/spaces/"+firstSpace+"/subscription/invoices";
   assertEquals(403,second.get(membersPath).statusCode());
   assertEquals(404,second.get(invoicesPath).statusCode());
   assertEquals(403,outsider.get(membersPath).statusCode());
   assertEquals(404,outsider.get(invoicesPath).statusCode());
   var members=ok(first.get(membersPath),200);
   assertTrue(members.toString().contains("REFERENT"));
   assertTrue(members.toString().contains("ADMINISTRATEUR"));
   assertFalse(members.toString().contains(jdbc.queryForObject("SELECT email FROM utilisateur WHERE id=?",String.class,second.id)));
   assertEquals(200,first.get(invoicesPath).statusCode());
  } finally { cleanup(); }
 }
 @Test void ownerActivitySummaryIsPrivateAndExcludesDemoSpaces() throws Exception {
  try {
   var platform=actor();var member=actor();owner(platform);
   String path="/api/workspace/owner/activities-summary";
   assertEquals(401,new Actor().get(path).statusCode());
   assertEquals(403,member.get(path).statusCode());
   var summary=ok(platform.get(path),200);
   assertTrue(summary.get("upcomingActivities").asLong()>=0);
   assertTrue(summary.get("availablePlaces").asLong()>=0);
   assertTrue(summary.get("paidTickets").asLong()>=0);
  } finally { cleanup(); }
 }
 void cleanup() {
  for(long user:users) for(long space:jdbc.queryForList("SELECT id FROM espace_organisateur WHERE createur_id=?",Long.class,user)) {
   jdbc.update("DELETE FROM moderation_plateforme WHERE espace_id=?",space);
   jdbc.update("DELETE FROM abonnement_espace WHERE espace_id=?",space);
   jdbc.update("DELETE FROM annonce_groupe WHERE groupe_id IN (SELECT id FROM groupe WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM notification_activite WHERE activite_id IN (SELECT id FROM activite WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM inscription_activite WHERE activite_id IN (SELECT id FROM activite WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM historique_gestion_activite WHERE activite_id IN (SELECT id FROM activite WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM activite WHERE espace_id=?",space);
   jdbc.update("DELETE FROM demande_adhesion_groupe WHERE espace_id=?",space);
   jdbc.update("DELETE FROM historique_gestion_espace WHERE espace_id=?",space);
   jdbc.update("DELETE FROM soumission_projet WHERE projet_id IN (SELECT id FROM projet WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM projet WHERE espace_id=?",space);
   jdbc.update("DELETE FROM appartenance_groupe WHERE espace_id=?",space);
   jdbc.update("DELETE FROM invitation_groupe WHERE groupe_id IN (SELECT id FROM groupe WHERE espace_id=?)",space);
   jdbc.update("DELETE FROM groupe WHERE espace_id=?",space);
   jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);
   jdbc.update("DELETE FROM demande_espace WHERE espace_id=?",space);
   jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
  }
  for(long user:users) { jdbc.update("DELETE FROM demande_espace WHERE demandeur_id=? OR examinateur_id=?",user,user); jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",user); }
  for(long user:users) jdbc.update("DELETE FROM utilisateur WHERE id=?",user);
 }
 @Test void openingRequestNotifiesOwnerAndDecisionNotifiesApplicant() throws Exception {
  try {
   var applicant=actor(); var proprietor=actor(); owner(proprietor);
   var opened=request(applicant,"Espace notification");
   var ownerNotices=ok(proprietor.get("/api/workspace/notifications"),200);
   assertEquals(1,ownerNotices.size());
   assertEquals(1,ok(proprietor.get("/api/notifications/count"),200).get("unread").asInt());
   assertEquals(0,ok(applicant.get("/api/notifications/count"),200).get("unread").asInt());
   assertEquals("DEMANDE_RECUE",ownerNotices.get(0).get("event").asText());
   assertEquals(200,proprietor.post("/api/workspace/notifications/"+ownerNotices.get(0).get("id").asLong()+"/read",Map.of(),true).statusCode());
   assertEquals(200,proprietor.post("/api/workspace/notifications/"+ownerNotices.get(0).get("id").asLong()+"/read",Map.of(),true).statusCode());
   assertEquals(0,ok(proprietor.get("/api/notifications/count"),200).get("unread").asInt());
   assertEquals(0,ok(proprietor.get("/api/workspace/notifications"),200).size());
   assertEquals(404,applicant.post("/api/workspace/notifications/"+ownerNotices.get(0).get("id").asLong()+"/read",Map.of(),true).statusCode());
   ok(proprietor.post("/api/workspace/opening-requests/"+opened.get("id").asLong()+"/decision",
       Map.of("version",opened.get("version").asLong(),"status","REFUSEE","reason","Informations insuffisantes"),true),200);
   var applicantNotices=ok(applicant.get("/api/workspace/notifications"),200);
   assertEquals(1,applicantNotices.size());
   assertEquals(1,ok(applicant.get("/api/notifications/count"),200).get("unread").asInt());
   assertEquals("DEMANDE_REFUSEE",applicantNotices.get(0).get("event").asText());
  } finally { cleanup(); }
 }
 @Test void subscriptionIsSpaceScopedAndOnlySignedWebhookActivatesPro() throws Exception {
  try {
   var admin=actor(); var other=actor();
   long space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Espace abonnement','ASSOCIATION',?) RETURNING id",Long.class,admin.id);
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",admin.id,space);
   String path="/api/workspace/spaces/"+space+"/subscription";
   assertEquals(401,new Actor().get(path).statusCode());
   assertEquals(404,other.get(path).statusCode());
   assertEquals("STARTER",ok(admin.get(path),200).get("plan").asText());
   assertEquals(403,admin.post(path+"/checkout",Map.of("requestId",UUID.randomUUID()),false).statusCode());
   assertEquals(503,admin.post(path+"/checkout",Map.of("requestId",UUID.randomUUID()),true).statusCode());
   jdbc.update("INSERT INTO abonnement_espace(espace_id,administrateur_id,session_stripe) VALUES (?,?,'cs_test_subscription123')",space,admin.id);
   String payload="""
     {"id":"evt_test_subscription","object":"event","created":%d,"livemode":false,"type":"checkout.session.completed",
      "data":{"object":{"id":"cs_test_subscription123","object":"checkout.session","client_reference_id":"space-subscription-%d",
      "subscription":"sub_test_subscription123","customer":"cus_test_subscription123","mode":"subscription",
      "payment_status":"paid","currency":"eur","amount_subtotal":1000}}}
     """.formatted(System.currentTimeMillis()/1000,space);
   var mac=javax.crypto.Mac.getInstance("HmacSHA256");
   mac.init(new javax.crypto.spec.SecretKeySpec("whsec_test_subscription_local".getBytes(java.nio.charset.StandardCharsets.UTF_8),"HmacSHA256"));
   long timestamp=System.currentTimeMillis()/1000;
   String digest=HexFormat.of().formatHex(mac.doFinal((timestamp+"."+payload).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
   var target=URI.create("http://localhost:"+port+"/api/stripe/subscriptions/webhook");
   var invalid=HttpRequest.newBuilder(target).header("Stripe-Signature","t="+timestamp+",v1="+"0".repeat(64))
     .POST(HttpRequest.BodyPublishers.ofString(payload)).build();
   assertEquals(400,HttpClient.newHttpClient().send(invalid,HttpResponse.BodyHandlers.ofString()).statusCode());
   assertEquals("STARTER",ok(admin.get(path),200).get("plan").asText());
   var valid=HttpRequest.newBuilder(target).header("Stripe-Signature","t="+timestamp+",v1="+digest)
     .POST(HttpRequest.BodyPublishers.ofString(payload)).build();
   assertEquals(204,HttpClient.newHttpClient().send(valid,HttpResponse.BodyHandlers.ofString()).statusCode());
   assertEquals(204,HttpClient.newHttpClient().send(valid,HttpResponse.BodyHandlers.ofString()).statusCode());
   assertEquals("PRO",ok(admin.get(path),200).get("plan").asText());
   assertEquals(404,other.get(path).statusCode());
  } finally { cleanup(); }
 }
 @Test void stripeConnectIsLimitedToActiveSpaceAdminsAndTestConfiguration() throws Exception {
  try {
   var admin=actor(); var outsider=actor();
   long space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES (?,?,?) RETURNING id",Long.class,
     "Atelier Stripe Test", "ORGANISATEUR", admin.id);
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",admin.id,space);
   String path="/api/workspace/spaces/"+space+"/stripe-connect";
   assertEquals(401,new Actor().get(path).statusCode());
   assertEquals(404,outsider.get(path).statusCode());
   assertEquals(403,admin.post(path+"/onboarding",Map.of(),false).statusCode());
   assertFalse(ok(admin.get(path),200).get("configured").asBoolean());
   assertEquals(503,admin.post(path+"/onboarding",Map.of(),true).statusCode());
   assertNull(jdbc.queryForObject("SELECT stripe_account_id FROM espace_organisateur WHERE id=?",String.class,space));
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE espace_id=? AND utilisateur_id=?",space,admin.id);
   assertEquals(404,admin.get(path).statusCode());
   assertEquals(404,admin.post(path+"/onboarding",Map.of(),true).statusCode());
  } finally { cleanup(); }
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
    jdbc.update("UPDATE espace_organisateur SET statut='FERME' WHERE id=?",space);
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
 @Test void dashboardChartsAreLimitedToTheOwnerOrTheSelectedAdminSpace() throws Exception {
  try {
   var admin=actor(); var outsider=actor(); var platform=actor(); owner(platform);
   long space=setupSpace(admin);
   String scoped="/api/workspace/charts/spaces/"+space;
   assertEquals(403,outsider.get(scoped).statusCode());
   assertEquals(403,platform.get(scoped).statusCode());
   assertEquals(403,admin.get("/api/workspace/charts/owner").statusCode());
   var months=ok(platform.get("/api/workspace/charts/owner"),200);
   assertEquals(6,months.size());
   assertTrue(months.get(0).has("activityCents"));
   var scopedData=ok(admin.get(scoped),200);
   assertEquals(0,scopedData.get("activities").size());
   assertEquals(6,scopedData.get("months").size());
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=? AND espace_id=?",admin.id,space);
   assertEquals(403,admin.get(scoped).statusCode());
  } finally { cleanup(); }
 }
 long setupGroup(long space,String name,boolean open,String visibility) {
  return jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,adhesion_ouverte,visibilite) VALUES (?,?,?,?) RETURNING id",Long.class,space,name,open,visibility);
 }
 @Test void memberCanBelongToAtMostTwoGroupsAcrossSpaces() throws Exception {
  try {
   var admin=actor();var member=actor();long firstSpace=setupSpace(admin),secondSpace=setupSpace(admin);
   long first=setupGroup(firstSpace,"Premier groupe",false,"PUBLIQUE");
   long second=setupGroup(secondSpace,"Deuxième groupe",false,"PUBLIQUE");
   long third=setupGroup(secondSpace,"Troisième groupe",false,"PUBLIQUE");
   long firstRequest=ok(member.post("/api/groups/"+first+"/join",Map.of(),true),200).get("id").asLong();
   long secondRequest=ok(member.post("/api/groups/"+second+"/join",Map.of(),true),200).get("id").asLong();
   long thirdRequest=ok(member.post("/api/groups/"+third+"/join",Map.of(),true),200).get("id").asLong();
   var accept=Map.of("version",0,"status","ACCEPTEE","reason","");
   ok(admin.post("/api/group-memberships/"+firstRequest+"/decision",accept,true),200);
   ok(admin.post("/api/group-memberships/"+secondRequest+"/decision",accept,true),200);
   assertEquals(409,admin.post("/api/group-memberships/"+thirdRequest+"/decision",accept,true).statusCode());
   assertEquals("EN_ATTENTE",jdbc.queryForObject("SELECT statut FROM demande_adhesion_groupe WHERE id=?",String.class,thirdRequest));
   long fourth=setupGroup(firstSpace,"Quatrième groupe",false,"PUBLIQUE");
   assertEquals(409,member.post("/api/groups/"+fourth+"/join",Map.of(),true).statusCode());
   long privateGroup=setupGroup(secondSpace,"Groupe privé limité",false,"PRIVEE");
   String email=jdbc.queryForObject("SELECT email FROM utilisateur WHERE id=?",String.class,member.id);
   long invitation=ok(admin.post("/api/groups/"+privateGroup+"/invite",Map.of("email",email),true),201).get("id").asLong();
   assertEquals(409,member.post("/api/groups/invitations/"+invitation+"/accept",Map.of(),true).statusCode());
   assertEquals("EN_ATTENTE",jdbc.queryForObject("SELECT statut FROM invitation_groupe WHERE id=?",String.class,invitation));
   assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM appartenance_groupe WHERE utilisateur_id=? AND statut='ACTIF'",Integer.class,member.id));
  } finally { cleanup(); }
 }
 @Test void groupMemberCanRequestOwnOrganiserSpace() throws Exception {
  try {
   var admin=actor(); var member=actor(); var platform=actor(); owner(platform);
   long existingSpace=setupSpace(admin), group=setupGroup(existingSpace,"Groupe membre",false,"PUBLIQUE");
   long joinRequest=ok(member.post("/api/groups/"+group+"/join",Map.of(),true),200).get("id").asLong();
   ok(admin.post("/api/group-memberships/"+joinRequest+"/decision",Map.of("version",0,"status","ACCEPTEE","reason",""),true),200);
   long opening=request(member,"Mon espace organisateur").get("id").asLong();
   assertEquals("EN_ATTENTE",ok(member.get("/api/workspace/requests"),200).get(0).get("status").asText());
   long ownSpace=ok(platform.post("/api/workspace/opening-requests/"+opening+"/decision",Map.of("version",0,"status","APPROUVEE","reason",""),true),200).get("spaceId").asLong();
   assertEquals("ADMINISTRATEUR",jdbc.queryForObject("SELECT role FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?",String.class,member.id,ownSpace));
   assertEquals("MEMBRE",jdbc.queryForObject("SELECT role FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?",String.class,member.id,existingSpace));
  } finally { cleanup(); }
 }
 @Test void privateGroupInvitationAdmitsOnlyLinkHolder() throws Exception {
  try {
   var admin=actor();var outsider=actor();long space=setupSpace(admin);
   long group=setupGroup(space,"Groupe privé invité",true,"PRIVEE");
   String code=jdbc.queryForObject("SELECT invitation_code::text FROM groupe WHERE id=?",String.class,group);
   assertFalse(ok(outsider.get("/api/groups"),200).toString().contains("Groupe privé invité"));
   assertEquals(404,outsider.post("/api/groups/"+group+"/join",Map.of(),true).statusCode());
   assertEquals("Groupe privé invité",ok(outsider.get("/api/groups/invitations/"+code),200).get("name").asText());
   long request=ok(outsider.post("/api/groups/invitations/"+code+"/join",Map.of(),true),200).get("id").asLong();
   assertEquals("EN_ATTENTE",jdbc.queryForObject("SELECT statut FROM demande_adhesion_groupe WHERE id=?",String.class,request));
   assertFalse(ok(outsider.get("/api/groups"),200).toString().contains("Groupe privé invité"));
   ok(admin.post("/api/group-memberships/"+request+"/decision",Map.of("version",0,"status","ACCEPTEE","reason",""),true),200);
   assertTrue(ok(outsider.get("/api/groups"),200).toString().contains("Groupe privé invité"));
  } finally { cleanup(); }
 }
 @Test void privateGroupCanInviteExistingAccountDirectly() throws Exception {
  try {
   var admin=actor();var invited=actor();var stranger=actor();long space=setupSpace(admin);
   long group=setupGroup(space,"Groupe sur invitation",false,"PRIVEE");
   String email=jdbc.queryForObject("SELECT email FROM utilisateur WHERE id=?",String.class,invited.id);
   String path="/api/groups/"+group+"/invite";
   assertEquals(403,stranger.post(path,Map.of("email",email),true).statusCode());
   long invitation=ok(admin.post(path,Map.of("email",email),true),201).get("id").asLong();
   assertEquals(0,ok(stranger.get("/api/groups/invitations/mine"),200).size());
   assertEquals(1,ok(invited.get("/api/groups/invitations/mine"),200).size());
   assertTrue(ok(invited.get("/api/mobile/notifications"),200).toString().contains("group-invite"));
   assertEquals(404,stranger.post("/api/mobile/notifications/group-invite/"+invitation+"/read",Map.of(),true).statusCode());
   assertFalse(ok(invited.get("/api/groups"),200).toString().contains("Groupe sur invitation"));
   assertEquals(404,stranger.post("/api/groups/invitations/"+invitation+"/accept",Map.of(),true).statusCode());
   assertEquals("REFUSEE",ok(invited.post("/api/groups/invitations/"+invitation+"/decline",Map.of(),true),200).get("status").asText());
   assertFalse(ok(invited.get("/api/groups"),200).toString().contains("Groupe sur invitation"));
   assertEquals(invitation,ok(admin.post(path,Map.of("email",email),true),201).get("id").asLong());
   assertEquals("ACCEPTEE",ok(invited.post("/api/groups/invitations/"+invitation+"/accept",Map.of(),true),200).get("status").asText());
   assertTrue(ok(invited.get("/api/groups"),200).toString().contains("Groupe sur invitation"));
   assertEquals(404,invited.post("/api/groups/invitations/"+invitation+"/accept",Map.of(),true).statusCode());
  } finally { cleanup(); }
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
   var adminNotice=ok(admin.get("/api/group-memberships/notifications"),200);
   assertEquals(1,adminNotice.size());
   assertEquals("DEMANDE_RECUE",adminNotice.get(0).get("event").asText());
   assertEquals(404,other.post("/api/group-memberships/notifications/"+adminNotice.get(0).get("id").asLong()+"/read",Map.of(),true).statusCode());
   assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM appartenance_espace WHERE utilisateur_id=?",Integer.class,member.id));
   assertEquals(0,ok(other.get("/api/group-memberships"),200).size());
   assertEquals(0,ok(other.get("/api/group-memberships/received"),200).size());
   assertEquals(0,ok(platform.get("/api/group-memberships/received"),200).size());
   assertEquals(1,ok(admin.get("/api/group-memberships/received"),200).size());
   var accept=Map.of("version",0,"status","ACCEPTEE","reason","");String decision="/api/group-memberships/"+req+"/decision";
   assertEquals(403,other.post(decision,accept,true).statusCode());assertEquals(403,platform.post(decision,accept,true).statusCode());
   assertEquals(403,admin.post(decision,accept,false).statusCode());
   assertEquals("ACCEPTEE",ok(admin.post(decision,accept,true),200).get("status").asText());
   assertEquals(0,ok(admin.get("/api/group-memberships/notifications"),200).size());
   assertEquals("DEMANDE_ACCEPTEE",ok(member.get("/api/group-memberships/notifications"),200).get(0).get("event").asText());
   ok(admin.post(decision,accept,true),200);
   assertEquals("MEMBRE",jdbc.queryForObject("SELECT role FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?",String.class,member.id,space));
   assertEquals("MEMBRE",jdbc.queryForObject("SELECT role FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",String.class,member.id,closed));
   assertEquals(1,ok(member.get("/api/workspace"),200).get("groups").size());
   assertTrue(ok(member.get("/api/groups"),200).toString().contains("Confidentiel"));
   assertEquals("EN_ATTENTE",ok(member.post("/api/groups/"+secret+"/join",Map.of(),true),200).get("status").asText());
   // Even a formerly open public group requires administrator approval.
   long openRequest=ok(other.post("/api/groups/"+open+"/join",Map.of(),true),200).get("id").asLong();
   assertEquals("EN_ATTENTE",jdbc.queryForObject("SELECT statut FROM demande_adhesion_groupe WHERE id=?",String.class,openRequest));
   assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",Integer.class,other.id,open));
   ok(admin.post("/api/group-memberships/"+openRequest+"/decision",accept,true),200);
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
    assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM appartenance_groupe WHERE utilisateur_id=? AND groupe_id=?",Integer.class,member.id,open));
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
 @Test void groupLifecycleAuthorizationPreservationAndReactivation() throws Exception {
  try {
   var admin=actor();var ref=actor();var other=actor();var platform=actor();owner(platform);
   long space=setupSpace(admin),otherSpace=setupSpace(other);
   long group=setupGroup(space,"Cycle de vie",false,"PUBLIQUE");addMember(ref,space,group,"REFERENT");
   String base="/api/workspace/spaces/"+space+"/groups/"+group, path=base+"/status";
   var suspend=Map.of("version",0,"status","SUSPENDU");
   assertEquals(401,new Actor().post(path,suspend,true).statusCode());
   assertEquals(403,admin.post(path,suspend,false).statusCode());
   for(var denied:List.of(ref,other,platform)) assertEquals(403,denied.post(path,suspend,true).statusCode());
   assertEquals(404,other.post("/api/workspace/spaces/"+otherSpace+"/groups/"+group+"/status",suspend,true).statusCode());
   assertEquals(400,admin.post(path,Map.of("version",0,"status","SUPPRIME"),true).statusCode());
   long request=ok(other.post("/api/groups/"+group+"/join",Map.of(),true),200).get("id").asLong();
   var draft=Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",Map.of("title","Projet à conserver","description","Une idée collective","objective","Rassembler les voisins"));
   long project=ok(admin.post("/api/project-drafts",draft,true),201).get("id").asLong();
   assertEquals("SUSPENDU",ok(admin.post(path,suspend,true),200).get("status").asText());
   assertEquals(409,admin.post(path,suspend,true).statusCode());
   assertFalse(new Actor().get("/api/groups").body().contains("Cycle de vie"));
   assertEquals(409,admin.post(base,Map.of("version",1,"content",gc("Modification interdite")),true).statusCode());
   assertEquals(403,admin.post("/api/project-drafts",draft,true).statusCode());
   assertEquals(409,admin.post("/api/group-memberships/"+request+"/decision",Map.of("version",0,"status","ACCEPTEE","reason",""),true).statusCode());
   assertEquals("ACTIF",ok(admin.post(path,Map.of("version",1,"status","ACTIF"),true),200).get("status").asText());
   assertTrue(new Actor().get("/api/groups").body().contains("Cycle de vie"));
   assertEquals("REFERENT",jdbc.queryForObject("SELECT role FROM appartenance_groupe WHERE groupe_id=? AND utilisateur_id=?",String.class,group,ref.id));
   assertEquals("ARCHIVE",ok(admin.post(path,Map.of("version",2,"status","ARCHIVE"),true),200).get("status").asText());
   assertEquals(409,admin.post(path,Map.of("version",3,"status","ACTIF"),true).statusCode());
   assertEquals(409,admin.post(path,Map.of("version",3,"status","SUSPENDU"),true).statusCode());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM projet WHERE id=?",Integer.class,project));
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM demande_adhesion_groupe WHERE id=?",Integer.class,request));
   assertEquals(3,jdbc.queryForObject("SELECT count(*) FROM historique_gestion_espace WHERE groupe_id=? AND action IN ('GROUPE_SUSPENDU','GROUPE_REACTIVE','GROUPE_ARCHIVE')",Integer.class,group));
   assertEquals("ARCHIVE",ok(admin.get("/api/workspace/spaces/"+space+"/management"),200).get("groups").get(0).get("status").asText());
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=? AND espace_id=?",admin.id,space);
   assertEquals(403,admin.post(path,Map.of("version",3,"status","ARCHIVE"),true).statusCode());
  } finally { cleanup(); }
 }
 @Test void concurrentGroupStatusChangesDoNotOverwrite() throws Exception {
  try {
   var admin=actor(); long space=setupSpace(admin),group=setupGroup(space,"Cycle concurrent",false,"PUBLIQUE");
   String path="/api/workspace/spaces/"+space+"/groups/"+group+"/status";
   try(var pool=Executors.newFixedThreadPool(2)) {
    var a=pool.submit(()->admin.post(path,Map.of("version",0,"status","SUSPENDU"),true));
    var b=pool.submit(()->admin.post(path,Map.of("version",0,"status","ARCHIVE"),true));
    var codes=new ArrayList<>(List.of(a.get(20,TimeUnit.SECONDS).statusCode(),b.get(20,TimeUnit.SECONDS).statusCode()));
    Collections.sort(codes);assertEquals(List.of(200,409),codes);
   }
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM historique_gestion_espace WHERE groupe_id=?",Integer.class,group));
  } finally { cleanup(); }
 }

 Map<String,Object> activityContent() {
  var c=new HashMap<String,Object>();
  c.put("title","Balade du quartier");c.put("category","nature");c.put("city","Bruxelles");c.put("location","Place du quartier");
  c.put("price",0);c.put("image","balade");c.put("startsAt","2099-06-20T10:00:00+02:00");c.put("closesAt","2099-06-19T18:00:00+02:00");
  c.put("description","Découvrir les jardins ensemble");c.put("duration","2 heures");c.put("capacity",4);c.put("audience","Tout public");
  c.put("meetingPoint","Devant la fontaine");c.put("preparation","Prévoir de bonnes chaussures");c.put("visibility","PUBLIQUE");return c;
 }
 Map<String,Object> booking(String slug) { return Map.of("activityId",slug,"quantity",1,"firstName","Test","lastName","Inscription","email","test@example.com","phone","","acknowledged",true); }
 @Test void paidActivityCanBePublishedAsLocalDemoWithoutCreatingPaidReservations() throws Exception {
  try {
   var admin=actor();var participant=actor();long space=setupSpace(admin);
   var content=activityContent();content.put("price",2.46);
   String path="/api/managed-activities";
   var created=ok(admin.post(path,Map.of("requestId",UUID.randomUUID(),"spaceId",space,"content",content),true),201);
   long id=created.get("id").asLong();String slug=created.get("slug").asText();
   assertEquals(503,admin.post(path+"/"+id+"/publication",Map.of("version",0,"published",true),true).statusCode());
   assertEquals(403,participant.post(path+"/"+id+"/publication",Map.of("version",0,"published",true,"demonstration",true),true).statusCode());
   var published=ok(admin.post(path+"/"+id+"/publication",Map.of("version",0,"published",true,"demonstration",true),true),200);
   assertTrue(published.get("published").asBoolean());assertTrue(published.get("demonstration").asBoolean());
   var myActivities=ok(admin.get(path+"/paged?filter=ALL&page=0"),200);
   assertEquals(id,myActivities.get("items").get(0).get("id").asLong());
   assertEquals(0,ok(participant.get(path+"/paged?filter=ALL&page=0"),200).get("total").asInt());
   assertTrue(ok(participant.get("/api/activities/"+slug),200).get("demonstration").asBoolean());
   var request=new HashMap<String,Object>(booking(slug));request.put("requestId",UUID.randomUUID());
   assertEquals(503,participant.post("/api/paid-activity-bookings",request,true).statusCode());
   assertEquals(409,participant.post("/api/bookings",booking(slug),true).statusCode());
   assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM reservation_payante_activite WHERE activite_id=?",Integer.class,id));
  } finally { cleanup(); }
 }
 @Test void organizerDashboardShowsOnlyOwnUpcomingActivityAndRealAvailability() throws Exception {
  try {
   var admin=actor();var member=actor();var other=actor();long space=setupSpace(admin),group=setupGroup(space,"Suivi",false,"PUBLIQUE");
   addMember(member,space,group,"MEMBRE");
   String path="/api/managed-activities";
   assertEquals(401,new Actor().get(path+"/dashboard").statusCode());
   assertEquals(204,member.get(path+"/dashboard").statusCode());
   assertEquals(204,other.get(path+"/dashboard").statusCode());
   var activity=ok(admin.post(path,Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",activityContent()),true),201);
   long id=activity.get("id").asLong();String slug=activity.get("slug").asText();
   assertEquals(204,admin.get(path+"/dashboard").statusCode());
   ok(admin.post(path+"/"+id+"/publication",Map.of("version",0,"published",true),true),200);
   var dashboard=ok(admin.get(path+"/dashboard"),200);
   assertEquals(id,dashboard.get("id").asLong());assertEquals(4,dashboard.get("remaining").asInt());
   assertEquals(space,dashboard.get("spaceId").asLong());
   assertEquals(id,ok(admin.get(path+"/dashboard?spaceId="+space),200).get("id").asLong());
   assertEquals(403,other.get(path+"/dashboard?spaceId="+space).statusCode());
   assertEquals(403,member.get(path+"/dashboard?spaceId="+space).statusCode());
   assertEquals(0,dashboard.get("paidTickets").asInt());assertEquals(0,dashboard.get("confirmedCents").asLong());
   ok(member.post("/api/bookings",booking(slug),true),201);
   assertEquals(3,ok(admin.get(path+"/dashboard"),200).get("remaining").asInt());
   assertEquals(204,member.get(path+"/dashboard").statusCode());
  } finally { cleanup(); }
 }
 @Test void activityAuthoringPublicationIsolationAndBookingProtection() throws Exception {
  try {
   var admin=actor();var other=actor();var ref=actor();var platform=actor();owner(platform);
   long space=setupSpace(admin),otherSpace=setupSpace(other),group=setupGroup(space,"Activités du quartier",false,"PUBLIQUE");addMember(ref,space,group,"REFERENT");
   var content=activityContent();var creation=Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",content);
   String path="/api/managed-activities";
   assertEquals(401,new Actor().get(path).statusCode());
   assertEquals(403,admin.post(path,creation,false).statusCode());
   for(var denied:List.of(other,ref,platform)) assertEquals(403,denied.post(path,creation,true).statusCode());
   assertEquals(409,other.post(path,Map.of("requestId",UUID.randomUUID(),"spaceId",otherSpace,"groupId",group,"content",content),true).statusCode());
   var a=ok(admin.post(path,creation,true),201);long id=a.get("id").asLong();String slug=a.get("slug").asText();
   assertEquals(id,ok(admin.post(path,creation,true),201).get("id").asLong());
   assertEquals(0,ok(other.get(path),200).size());assertEquals(1,ok(admin.get(path),200).size());
   assertEquals(404,new Actor().get("/api/activities/"+slug).statusCode());
   assertEquals(404,other.post("/api/bookings",booking(slug),true).statusCode());
   content.put("title","Balade modifiée");
   var update=Map.of("version",0,"content",content);
   assertEquals(403,ref.post(path+"/"+id,update,true).statusCode());
   ok(admin.post(path+"/"+id,update,true),200);assertEquals(409,admin.post(path+"/"+id,update,true).statusCode());
   var pub=Map.of("version",1,"published",true);
   assertEquals(403,platform.post(path+"/"+id+"/publication",pub,true).statusCode());
   ok(admin.post(path+"/"+id+"/publication",pub,true),200);
   assertEquals(200,new Actor().get("/api/activities/"+slug).statusCode());
   assertEquals(409,admin.post(path+"/"+id,Map.of("version",2,"content",content),true).statusCode());
   long booked=ok(other.post("/api/bookings",booking(slug),true),201).get("id").asLong();
   assertEquals(409,admin.post(path+"/"+id+"/publication",Map.of("version",2,"published",false),true).statusCode());
   assertEquals(3,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE id=?",Integer.class,id));
   assertEquals(204,other.post("/api/bookings/"+booked+"/cancel",Map.of(),true).statusCode());
   ok(admin.post(path+"/"+id+"/publication",Map.of("version",2,"published",false),true),200);
   assertEquals(404,new Actor().get("/api/activities/"+slug).statusCode());
   content.put("price",12.50);ok(admin.post(path+"/"+id,Map.of("version",3,"content",content),true),200);
   assertEquals(503,admin.post(path+"/"+id+"/publication",Map.of("version",4,"published",true),true).statusCode());
   content.put("closesAt","2100-01-01T00:00:00Z");assertEquals(400,admin.post(path+"/"+id,Map.of("version",4,"content",content),true).statusCode());
   content.put("closesAt","2000-01-01T00:00:00Z");assertEquals(400,admin.post(path+"/"+id,Map.of("version",4,"content",content),true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=? AND espace_id=?",admin.id,space);
   assertEquals(403,admin.post(path+"/"+id+"/publication",Map.of("version",4,"published",true),true).statusCode());
  } finally { cleanup(); }
 }
 @Test void privateActivitiesDeadlineAndInactiveGroupsAreEnforced() throws Exception {
  try {
   var admin=actor();var member=actor();var outsider=actor();long space=setupSpace(admin),group=setupGroup(space,"Activités privées",false,"PRIVEE");addMember(member,space,group,"MEMBRE");
   var content=activityContent();content.put("visibility","PRIVEE");String path="/api/managed-activities";
   var a=ok(admin.post(path,Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",content),true),201);
   long id=a.get("id").asLong();String slug=a.get("slug").asText();ok(admin.post(path+"/"+id+"/publication",Map.of("version",0,"published",true),true),200);
   for(var denied:List.of(new Actor(),outsider)) { assertEquals(404,denied.get("/api/activities/"+slug).statusCode());assertFalse(denied.get("/api/activities").body().contains(slug)); }
   assertEquals(404,outsider.post("/api/bookings",booking(slug),true).statusCode());
   assertEquals(200,member.get("/api/activities/"+slug).statusCode());
   jdbc.update("UPDATE activite SET cloture_inscriptions=now()-interval '1 hour' WHERE id=?",id);
   assertEquals(409,member.post("/api/bookings",booking(slug),true).statusCode());
   jdbc.update("UPDATE activite SET cloture_inscriptions=debut WHERE id=?",id);
   long booked=ok(member.post("/api/bookings",booking(slug),true),201).get("id").asLong();
   ok(admin.post("/api/workspace/spaces/"+space+"/groups/"+group+"/status",Map.of("version",0,"status","SUSPENDU"),true),200);
   assertEquals(404,member.get("/api/activities/"+slug).statusCode());
   assertEquals(409,admin.post(path+"/"+id+"/publication",Map.of("version",1,"published",false),true).statusCode());
   assertEquals(204,member.post("/api/bookings/"+booked+"/cancel",Map.of(),true).statusCode());
   ok(admin.post("/api/workspace/spaces/"+space+"/groups/"+group+"/status",Map.of("version",1,"status","ACTIF"),true),200);
   assertEquals(200,member.get("/api/activities/"+slug).statusCode());
   jdbc.update("UPDATE appartenance_groupe SET statut='RETIRE' WHERE utilisateur_id=? AND groupe_id=?",member.id,group);
   assertEquals(404,member.get("/api/activities/"+slug).statusCode());
   assertEquals(404,member.post("/api/bookings",booking(slug),true).statusCode());
   assertEquals(200,admin.get("/api/activities/"+slug).statusCode());
  } finally { cleanup(); }
 }
 @Test void publicationWithdrawalSerializesWithNewBooking() throws Exception {
  try {
   var admin=actor();var member=actor();long space=setupSpace(admin);String path="/api/managed-activities";
   var a=ok(admin.post(path,Map.of("requestId",UUID.randomUUID(),"spaceId",space,"content",activityContent()),true),201);
   long id=a.get("id").asLong();String slug=a.get("slug").asText();ok(admin.post(path+"/"+id+"/publication",Map.of("version",0,"published",true),true),200);
   try(var pool=Executors.newFixedThreadPool(2)) {
    var withdrawal=pool.submit(()->admin.post(path+"/"+id+"/publication",Map.of("version",1,"published",false),true));
    var reserve=pool.submit(()->member.post("/api/bookings",booking(slug),true));
    int w=withdrawal.get(20,TimeUnit.SECONDS).statusCode(),r=reserve.get(20,TimeUnit.SECONDS).statusCode();
    assertTrue((w==200 && r==404)||(w==409 && r==201),"withdrawal="+w+", reservation="+r);
   }
  } finally { cleanup(); }
 }

 @Test void activityRegisterAndCsvAreScopedAccurateAndSafe() throws Exception {
  try {
   var admin=actor();var participant=actor();var other=actor();var referent=actor();var platform=actor();owner(platform);
   long space=setupSpace(admin);setupSpace(other);long group=setupGroup(space,"Registre des activités",false,"PUBLIQUE");addMember(referent,space,group,"REFERENT");
   String managed="/api/managed-activities";
   var a=ok(admin.post(managed,Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",activityContent()),true),201);
   long id=a.get("id").asLong();String slug=a.get("slug").asText(),path=managed+"/"+id+"/registrations";
   var empty=ok(admin.get(path),200);assertEquals(0,empty.get("registrations").size());assertEquals(4,empty.get("remaining").asInt());
   var emptyCsv=admin.get(path+".csv");assertEquals(200,emptyCsv.statusCode());assertEquals(1,emptyCsv.body().lines().count());
   assertEquals(400,admin.get(path+"?status=INVALID").statusCode());assertEquals(400,admin.get(path+".csv?status=INVALID").statusCode());
   for(var denied:List.of(new Actor(),participant,other,referent,platform)) {
    int code=denied.id==0?401:403;
    assertEquals(code,denied.get(path).statusCode());assertEquals(code,denied.get(path+".csv").statusCode());
   }
   ok(admin.post(managed+"/"+id+"/publication",Map.of("version",0,"published",true),true),200);
   var details=new HashMap<String,Object>(booking(slug));details.put("quantity",2);details.put("firstName","=SUM(1;1)");details.put("lastName","Du\"pont;Été\nSuite");details.put("phone","+32000000000");
   long first=ok(participant.post("/api/bookings",details,true),201).get("id").asLong();
   ok(other.post("/api/bookings",booking(slug),true),201);
   var all=ok(admin.get(path),200);assertEquals(2,all.get("confirmed").asInt());assertEquals(3,all.get("reserved").asInt());assertEquals(1,all.get("remaining").asInt());
   assertTrue(admin.get(path).headers().firstValue("Cache-Control").orElse("").contains("no-store"));
   var csv=admin.get(path+".csv?status=CONFIRMEE");assertEquals(200,csv.statusCode());
   assertTrue(csv.headers().firstValue("Content-Type").orElse("").contains("text/csv"));assertTrue(csv.headers().firstValue("Content-Disposition").orElse("").contains("attachment;"));
   assertTrue(csv.headers().firstValue("Cache-Control").orElse("").contains("no-store"));
   assertTrue(csv.body().startsWith("\uFEFFIdentifiant;"));assertTrue(csv.body().contains("\"'=SUM(1;1)\""));
   assertTrue(csv.body().contains("\"Du\"\"pont;Été\nSuite\""));assertTrue(csv.body().contains("\"'+32000000000\""));
   assertEquals(204,participant.post("/api/bookings/"+first+"/cancel",Map.of(),true).statusCode());
   var confirmed=ok(admin.get(path+"?status=CONFIRMEE"),200);assertEquals(1,confirmed.get("registrations").size());assertEquals(1,confirmed.get("reserved").asInt());assertEquals(3,confirmed.get("remaining").asInt());assertEquals(1,confirmed.get("cancelled").asInt());
   var cancelled=ok(admin.get(path+"?status=ANNULEE"),200);assertEquals(first,cancelled.get("registrations").get(0).get("id").asLong());assertFalse(cancelled.get("registrations").get(0).get("cancelledAt").isNull());
   assertFalse(admin.get(path+".csv?status=CONFIRMEE").body().contains("SUM"));assertTrue(admin.get(path+".csv?status=ANNULEE").body().contains("SUM"));
   jdbc.update("UPDATE groupe SET statut='ARCHIVE' WHERE id=?",group);assertEquals(200,admin.get(path).statusCode());assertEquals(200,admin.get(path+".csv").statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='RETIRE' WHERE utilisateur_id=? AND espace_id=?",admin.id,space);
   assertEquals(403,admin.get(path).statusCode());assertEquals(403,admin.get(path+".csv").statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='ACTIF' WHERE utilisateur_id=? AND espace_id=?",admin.id,space);
   jdbc.update("UPDATE espace_organisateur SET statut='SUSPENDU' WHERE id=?",space);assertEquals(200,admin.get(path).statusCode());assertEquals(200,admin.get(path+".csv").statusCode());
   jdbc.update("UPDATE espace_organisateur SET statut='ACTIF' WHERE id=?",space);
   jdbc.update("UPDATE utilisateur SET statut='SUSPENDU' WHERE id=?",admin.id);assertEquals(401,admin.get(path+".csv").statusCode());
  } finally { cleanup(); }
 }

 @Test void referentsOrganizeOnlyTheirDelegatedGroupsAndLoseAccessImmediately() throws Exception {
  try {
   var admin=actor();var ref=actor();var member=actor();long space=setupSpace(admin);
   long group=setupGroup(space,"Sorties des voisins",false,"PUBLIQUE"),other=setupGroup(space,"Autre groupe",false,"PUBLIQUE");
   addMember(ref,space,group,"REFERENT");addMember(member,space,group,"MEMBRE");
   String permission="/api/workspace/groups/"+group+"/activity-permission",path="/api/managed-activities";
   var creation=Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",activityContent());
   assertEquals(403,ref.post(path,creation,true).statusCode());
   assertEquals(403,ref.post(permission,Map.of("version",0,"enabled",true),true).statusCode());
   assertEquals(403,admin.post(permission,Map.of("version",0,"enabled",true),false).statusCode());
   ok(admin.post(permission,Map.of("version",0,"enabled",true),true),200);
   assertEquals(409,admin.post(permission,Map.of("version",0,"enabled",true),true).statusCode());
   assertTrue(ok(ref.get("/api/workspace"),200).get("groups").get(0).get("canManageActivities").asBoolean());
   assertEquals(403,member.post(path,creation,true).statusCode());
   assertEquals(403,ref.post(path,Map.of("requestId",UUID.randomUUID(),"spaceId",space,"content",activityContent()),true).statusCode());
   assertEquals(403,ref.post(path,Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",other,"content",activityContent()),true).statusCode());
   var a=ok(ref.post(path,creation,true),201);long id=a.get("id").asLong();String slug=a.get("slug").asText();
   var otherA=ok(admin.post(path,Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",other,"content",activityContent()),true),201);
   assertEquals(1,ok(ref.get(path),200).size());
   assertEquals(403,ref.get(path+"/"+otherA.get("id").asLong()+"/registrations.csv").statusCode());
   ok(ref.post(path+"/"+id,Map.of("version",0,"content",activityContent()),true),200);
   ok(ref.post(path+"/"+id+"/publication",Map.of("version",1,"published",true),true),200);
   ok(member.post("/api/bookings",booking(slug),true),201);
   assertEquals(1,ok(ref.get(path+"/"+id+"/registrations"),200).get("registrations").size());
   assertEquals(200,ref.get(path+"/"+id+"/registrations.csv").statusCode());
   assertEquals(409,ref.post(path+"/"+id+"/publication",Map.of("version",2,"published",false),true).statusCode());
   ok(admin.post(permission,Map.of("version",1,"enabled",false),true),200);
   assertEquals(0,ok(ref.get(path),200).size());
   assertEquals(403,ref.get(path+"/"+id+"/registrations.csv").statusCode());
   assertEquals(403,ref.post(path+"/"+id+"/publication",Map.of("version",2,"published",false),true).statusCode());
   assertEquals(200,admin.get(path+"/"+id+"/registrations").statusCode());
   assertEquals(200,member.get("/api/activities/"+slug).statusCode());
   ok(admin.post(permission,Map.of("version",2,"enabled",true),true),200);
   jdbc.update("UPDATE appartenance_groupe SET role='MEMBRE' WHERE groupe_id=? AND utilisateur_id=?",group,ref.id);
   assertEquals(403,ref.get(path+"/"+id+"/registrations").statusCode());
   jdbc.update("UPDATE appartenance_groupe SET role='REFERENT' WHERE groupe_id=? AND utilisateur_id=?",group,ref.id);
   jdbc.update("UPDATE groupe SET statut='SUSPENDU' WHERE id=?",group);
   assertEquals(0,ok(ref.get(path),200).size());assertEquals(409,ref.get(path+"/"+id+"/registrations.csv").statusCode());
   assertEquals(200,admin.get(path+"/"+id+"/registrations.csv").statusCode());
  } finally { cleanup(); }
 }

 @Test void organizerCancellationClosesActivityAndMarksBookingsCancelled() throws Exception {
  try {
   var admin=actor();var referent=actor();var participant=actor();var outsider=actor();
   long space=setupSpace(admin),group=setupGroup(space,"Sorties simples",false,"PUBLIQUE");
   addMember(referent,space,group,"REFERENT");
   var created=ok(admin.post("/api/managed-activities",Map.of("requestId",UUID.randomUUID(),"spaceId",space,"groupId",group,"content",activityContent()),true),201);
   long id=created.get("id").asLong();String slug=created.get("slug").asText(),path="/api/managed-activities/"+id;
   assertEquals(409,admin.post(path+"/cancel",Map.of("version",0),true).statusCode());
   ok(admin.post(path+"/publication",Map.of("version",0,"published",true),true),200);
   long booking=ok(participant.post("/api/bookings",booking(slug),true),201).get("id").asLong();
   assertEquals(403,outsider.post(path+"/cancel",Map.of("version",1),true).statusCode());
   assertEquals(403,referent.post(path+"/cancel",Map.of("version",1),true).statusCode());
   ok(admin.post("/api/workspace/groups/"+group+"/activity-permission",Map.of("version",0,"enabled",true),true),200);
   var cancelled=ok(referent.post(path+"/cancel",Map.of("version",1),true),200);
   assertTrue(cancelled.get("cancelled").asBoolean());assertFalse(cancelled.get("published").asBoolean());
   assertEquals(4,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE id=?",Integer.class,id));
   assertEquals("ANNULEE",jdbc.queryForObject("SELECT statut FROM inscription_activite WHERE id=?",String.class,booking));
   var b=ok(participant.get("/api/bookings"),200).get(0);
   assertTrue(b.get("activityCancelled").asBoolean());assertEquals("ANNULEE",b.get("status").asText());
   var notice=ok(participant.get("/api/notifications"),200).get(0);
   assertEquals("Balade du quartier",notice.get("title").asText());
   long noticeId=notice.get("id").asLong();
   assertEquals(404,outsider.post("/api/notifications/"+noticeId+"/read",Map.of(),true).statusCode());
   assertEquals(204,participant.post("/api/notifications/"+noticeId+"/read",Map.of(),true).statusCode());
   assertEquals(0,ok(participant.get("/api/notifications"),200).size());
   assertEquals(404,new Actor().get("/api/activities/"+slug).statusCode());
   assertEquals(404,participant.post("/api/bookings",booking(slug),true).statusCode());
   assertEquals(409,admin.post(path+"/publication",Map.of("version",2,"published",true),true).statusCode());
   assertEquals(409,admin.post(path+"/cancel",Map.of("version",2),true).statusCode());
   assertEquals(200,admin.get(path+"/registrations").statusCode());
  } finally { cleanup(); }
 }

 @Test void groupAnnouncementsStayInsideActiveMemberships() throws Exception {
  try {
   var admin=actor();var ref=actor();var member=actor();var outsider=actor();long space=setupSpace(admin);
   long group=setupGroup(space,"Nouvelles du quartier",false,"PRIVEE"),other=setupGroup(space,"Autre groupe",false,"PRIVEE");
   addMember(ref,space,group,"REFERENT");addMember(member,space,group,"MEMBRE");
   String path="/api/group-announcements";UUID request=UUID.randomUUID();
   var content=Map.of("requestId",request,"groupId",group,"content","  Rendez-vous samedi !  ");
   assertEquals(401,new Actor().get(path).statusCode());
   assertEquals(403,ref.post(path,content,false).statusCode());
   assertEquals(403,member.post(path,content,true).statusCode());
   assertEquals(403,outsider.post(path,content,true).statusCode());
   assertEquals(403,ref.post(path,Map.of("requestId",UUID.randomUUID(),"groupId",other,"content","Essai"),true).statusCode());
   var posted=ok(ref.post(path,content,true),201);long id=posted.get("id").asLong();
   assertEquals("Rendez-vous samedi !",posted.get("content").asText());
   assertEquals(id,ok(ref.post(path,content,true),201).get("id").asLong());
   assertEquals(409,ref.post(path,Map.of("requestId",request,"groupId",group,"content","Autre texte"),true).statusCode());
   assertEquals(1,ok(member.get(path),200).size());assertEquals(0,ok(outsider.get(path),200).size());
   ok(admin.post(path,Map.of("requestId",UUID.randomUUID(),"groupId",other,"content","Annonce de l’autre groupe"),true),201);
   assertEquals(1,ok(member.get(path),200).size());assertEquals(2,ok(admin.get(path),200).size());
   jdbc.update("UPDATE appartenance_groupe SET statut='RETIRE' WHERE groupe_id=? AND utilisateur_id=?",group,member.id);
   assertEquals(0,ok(member.get(path),200).size());
   jdbc.update("UPDATE appartenance_groupe SET role='MEMBRE' WHERE groupe_id=? AND utilisateur_id=?",group,ref.id);
   assertEquals(403,ref.post(path,Map.of("requestId",UUID.randomUUID(),"groupId",group,"content","Essai"),true).statusCode());
   jdbc.update("UPDATE groupe SET statut='SUSPENDU' WHERE id=?",group);
   assertEquals(0,ok(ref.get(path),200).size());
  } finally { cleanup(); }
 }

 @Test void replacementAndScopedModerationPreservePublishedState() throws Exception {
  try {
   var admin=actor();var member=actor();var platform=actor();var outsider=actor();
   long space=setupSpace(admin);
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE')",member.id,space);
   owner(platform);
   String admins="/api/workspace/spaces/"+space+"/administrators";
   assertEquals(403,outsider.get(admins).statusCode());
   assertEquals(403,member.post(admins,Map.of("memberId",member.id,"reason","Remplacement prévu"),true).statusCode());
   assertEquals(403,platform.post(admins,Map.of("memberId",member.id,"reason","Récupération prématurée"),true).statusCode());
   var roster=ok(admin.post(admins,Map.of("memberId",member.id,"reason","Continuité de cet espace"),true),200);
   assertEquals(2,roster.size());
   assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM appartenance_espace WHERE espace_id=? AND role='ADMINISTRATEUR'",Integer.class,space));
   assertEquals(200,admin.post(admins+"/leave",Map.of(),true).statusCode());
   assertEquals(409,member.post(admins+"/leave",Map.of(),true).statusCode());
   String statusPath=admins+"/"+member.id+"/status";
   assertEquals(403,admin.post(statusPath,Map.of("status","SUSPENDU","reason","Signalement à examiner"),true).statusCode());
   assertEquals(200,platform.post(statusPath,Map.of("status","SUSPENDU","reason","Signalement à examiner"),true).statusCode());
   assertEquals("SUSPENDU",jdbc.queryForObject("SELECT statut FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=?",String.class,space,member.id));
   assertEquals(200,platform.post(statusPath,Map.of("status","ACTIF","reason","Examen terminé sans anomalie"),true).statusCode());
   assertEquals("ACTIF",jdbc.queryForObject("SELECT statut FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=?",String.class,space,member.id));
   long project=jdbc.queryForObject("""
     INSERT INTO projet(espace_id,auteur_id,titre,description,objectif,statut,publie,date_publication)
     VALUES (?,?,'Projet de modération','Description','Objectif','APPROUVE',true,now()) RETURNING id
     """,Long.class,space,member.id);
   long privateDraft=jdbc.queryForObject("""
     INSERT INTO projet(espace_id,auteur_id,titre,description,objectif)
     VALUES (?,?,'Brouillon secret','Description','Objectif') RETURNING id
     """,Long.class,space,member.id);
   assertEquals(200,outsider.get("/api/projects/"+project).statusCode());
   String moderation="/api/workspace/owner/moderation/spaces/"+space;
   assertEquals(404,platform.post(moderation+"/projects/"+privateDraft+"/hide",Map.of("reason","Ne doit pas accéder au brouillon"),true).statusCode());
   assertEquals(403,admin.post(moderation+"/projects/"+project+"/hide",Map.of("reason","Contenu à vérifier avant publication"),true).statusCode());
   assertEquals(204,platform.post(moderation+"/projects/"+project+"/hide",Map.of("reason","Contenu à vérifier avant publication"),true).statusCode());
   assertEquals(404,outsider.get("/api/projects/"+project).statusCode());
   assertEquals(true,jdbc.queryForObject("SELECT publie FROM projet WHERE id=?",Boolean.class,project));
   assertEquals(204,platform.post(moderation+"/projects/"+project+"/restore",Map.of("reason","Vérification terminée et conforme"),true).statusCode());
   assertEquals(200,outsider.get("/api/projects/"+project).statusCode());
   assertEquals(204,platform.post(moderation+"/suspend",Map.of("reason","Examen nécessaire des contenus de l’espace"),true).statusCode());
   assertEquals(404,outsider.get("/api/projects/"+project).statusCode());
   assertTrue(ok(member.get("/api/workspace"),200).get("suspendedSpaces").toString().contains("Examen nécessaire"));
   assertEquals(204,platform.post(moderation+"/reactivate",Map.of("reason","Examen terminé, espace conforme"),true).statusCode());
   assertEquals(200,outsider.get("/api/projects/"+project).statusCode());
   String replacement=jdbc.queryForObject("SELECT email FROM utilisateur WHERE id=?",String.class,outsider.id);
   assertEquals(409,platform.post(admins+"/recovery",Map.of("email",replacement,"reason","Vérification préalable"),true).statusCode());
   jdbc.update("UPDATE appartenance_espace SET statut='SUSPENDU' WHERE espace_id=? AND utilisateur_id=?",space,member.id);
   String suspendedEmail=jdbc.queryForObject("SELECT email FROM utilisateur WHERE id=?",String.class,member.id);
   assertEquals(409,platform.post(admins+"/recovery",Map.of("email",suspendedEmail,"reason","Nouvelle désignation envisagée"),true).statusCode());
   assertEquals(200,platform.post(admins+"/recovery",Map.of("email",replacement,"reason","Identité et représentation vérifiées"),true).statusCode());
   assertEquals("ADMINISTRATEUR",jdbc.queryForObject("SELECT role FROM appartenance_espace WHERE espace_id=? AND utilisateur_id=?",String.class,space,outsider.id));
  } finally { cleanup(); }
 }

}
