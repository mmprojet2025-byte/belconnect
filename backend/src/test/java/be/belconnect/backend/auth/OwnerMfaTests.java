package be.belconnect.backend.auth;

import java.net.*;
import java.net.http.*;
import java.util.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="OWNER_MFA_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
class OwnerMfaTests {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 @Autowired MobileTokenService tokens;
 @Autowired AccountRepository accounts;
 @Autowired OwnerMfaService mfa;
 @Autowired OwnerSessionService ownerSessions;
 final ObjectMapper json=new ObjectMapper();
 class Session {
  final HttpClient client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
  HttpResponse<String> get(String path)throws Exception{return client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).GET().build(),HttpResponse.BodyHandlers.ofString());}
  HttpResponse<String> post(String path,Object body,boolean csrf)throws Exception{
   var b=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Content-Type","application/json");
   if(csrf){var t=json.readTree(get("/api/auth/csrf").body());b.header(t.get("headerName").asText(),t.get("token").asText());}
   return client.send(b.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
  }
 }
 byte[] decode(String value){var out=new java.io.ByteArrayOutputStream();int buffer=0,bits=0;for(char c:value.toCharArray()){buffer=(buffer<<5)|"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c);bits+=5;if(bits>=8){bits-=8;out.write((buffer>>bits)&255);}}return out.toByteArray();}

 @Test void memberAndSpaceAdminCannotUseOwnerRoutes() throws Exception {
  String email="access-"+UUID.randomUUID()+"@example.com";
  var session=new Session();
  var registration=session.post("/api/auth/register",Map.of("email",email,"password","Secure-test-password-123","firstName","Access","lastName","Fixture"),true);
  assertEquals(201,registration.statusCode());
  long id=json.readTree(registration.body()).get("id").asLong();
  long space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Access fixture','ORGANISATEUR',?) RETURNING id",Long.class,id);
  var reads=List.of("/api/workspace/member-interventions","/api/workspace/member-interventions/scopes","/api/workspace/owner/dashboard/alerts","/api/workspace/opening-requests","/api/workspace/owner/dashboard","/api/workspace/owner/finance","/api/workspace/owner/activities-summary","/api/workspace/owner/subscriptions","/api/workspace/owner/invoices","/api/workspace/owner/pro-requests","/api/workspace/owner/members","/api/workspace/owner/members/paged","/api/workspace/owner/moderation","/api/workspace/owner/moderation/message-reports","/api/workspace/owner/moderation/spaces/"+space+"/content","/api/workspace/owner/contact-feedback","/api/auth/owner-mfa/events","/api/auth/owner-mfa/actions","/api/auth/owner-mfa/sessions");
  try {
   for(String path:reads) assertEquals(401,new Session().get(path).statusCode(),"Anonymous: "+path);
   jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'MEMBRE')",id,space);
   for(String role:List.of("MEMBRE","ADMINISTRATEUR")) {
    jdbc.update("UPDATE appartenance_espace SET role=? WHERE utilisateur_id=? AND espace_id=?",role,id,space);
    for(String path:reads) assertEquals(403,session.get(path).statusCode(),role+": "+path);
    assertEquals("false",session.get("/api/workspace/owner/access").body());
    String token=tokens.issue(accounts.findByEmail(email).orElseThrow());
    try {
     for(String path:reads) {
      var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofString());
      assertEquals(403,response.statusCode(),role+" mobile: "+path);
     }
    } finally { tokens.revoke(token); }
    assertEquals(403,session.post("/api/workspace/opening-requests/1/decision",Map.of("version",0,"status","REFUSEE","reason","Access control test reason"),true).statusCode());
    assertEquals(403,session.post("/api/workspace/opening-requests/1/reopen",Map.of("version",0,"reason","Access control test reason"),true).statusCode());

    for(String action:List.of("suspend","reactivate")) assertEquals(403,session.post("/api/workspace/owner/moderation/spaces/"+space+"/"+action,Map.of("reason","Access control test reason"),true).statusCode(),role+" "+action);
    assertEquals(403,session.post("/api/workspace/owner/pro-requests/"+space+"/take",Map.of(),true).statusCode());
    assertEquals(403,session.post("/api/workspace/spaces/"+space+"/administrators/recovery",Map.of("email",email,"reason","Access control test reason"),true).statusCode());
    assertEquals("ACTIF",jdbc.queryForObject("SELECT statut FROM espace_organisateur WHERE id=?",String.class,space));
   }
   // Removing the local role must remove its access on the existing session.
   assertEquals(200,session.get("/api/workspace/spaces/"+space+"/administrators").statusCode());
   jdbc.update("UPDATE appartenance_espace SET role='MEMBRE' WHERE utilisateur_id=? AND espace_id=?",id,space);
   assertEquals(403,session.get("/api/workspace/spaces/"+space+"/administrators").statusCode());
   jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",id);
   for(String path:reads) assertEquals(403,session.get(path).statusCode(),"Owner before MFA: "+path);
  } finally {
   jdbc.update("DELETE FROM session_mobile WHERE utilisateur_id=?",id);
   jdbc.update("DELETE FROM owner_web_session WHERE utilisateur_id=?",id);
   jdbc.update("DELETE FROM owner_security_event WHERE utilisateur_id=?",id);
   jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",id);
   jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);
   jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
   jdbc.update("DELETE FROM utilisateur WHERE id=?",id);
  }
 }
 @Test void rfcVectors(){byte[] secret="12345678901234567890".getBytes(java.nio.charset.StandardCharsets.US_ASCII);assertEquals("287082",OwnerMfaService.totp(secret,59/30));assertEquals("081804",OwnerMfaService.totp(secret,1111111109L/30));assertEquals("050471",OwnerMfaService.totp(secret,1111111111L/30));assertEquals("279037",OwnerMfaService.totp(secret,2000000000L/30));}
 @Test void ownerMustEnrollVerifyAndUseRecoveryOnlyOnce()throws Exception{
  String email="mfa-"+UUID.randomUUID()+"@example.com",password="Secure-test-password-123";var s=new Session();
  var created=s.post("/api/auth/register",Map.of("email",email,"password",password,"firstName","Test","lastName","MFA"),true);assertEquals(201,created.statusCode());long id=json.readTree(created.body()).get("id").asLong();
  try{
   assertFalse(json.readTree(s.get("/api/auth/owner-mfa/status").body()).get("owner").asBoolean());
   assertEquals(403,s.get("/api/auth/owner-mfa/events").statusCode());
   assertEquals(403,s.get("/api/workspace/owner/dashboard").statusCode());
   assertEquals(403,s.get("/api/auth/owner-mfa/actions").statusCode());
   jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",id);
   assertEquals(403,s.get("/api/workspace/owner/finance").statusCode());
   assertEquals(403,s.get("/api/auth/owner-mfa/events").statusCode());
   assertEquals(403,s.get("/api/workspace/owner/dashboard").statusCode());
   assertEquals(403,s.get("/api/auth/owner-mfa/actions").statusCode());
   assertEquals(403,s.post("/api/auth/owner-mfa/begin",Map.of("password",password),false).statusCode());
   var begin=s.post("/api/auth/owner-mfa/begin",Map.of("password",password),true);assertEquals(200,begin.statusCode());String secret=json.readTree(begin.body()).get("secret").asText();byte[] decoded=decode(secret);
   long step=Instant.now().getEpochSecond()/30;
   var confirmed=s.post("/api/auth/owner-mfa/confirm",Map.of("code",OwnerMfaService.totp(decoded,step)),true);assertEquals(200,confirmed.statusCode(),confirmed.body());var codes=json.readTree(confirmed.body()).get("recoveryCodes");assertEquals(10,codes.size());String backup=codes.get(0).asText();
   assertEquals(200,s.get("/api/workspace/owner/finance").statusCode());
   long space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('MFA audit fixture','ORGANISATEUR',?) RETURNING id",Long.class,id);
   jdbc.update("INSERT INTO abonnement_espace(espace_id,administrateur_id,statut) VALUES (?,?,'ANNULE')",space,id);
   try {
    var subscriptions=s.get("/api/workspace/owner/subscriptions");assertEquals(200,subscriptions.statusCode(),subscriptions.body());
    for(var row:json.readTree(subscriptions.body()))if(row.get("spaceId").asLong()==space)assertFalse(row.get("terminatedSubscription").asBoolean());
    jdbc.update("UPDATE abonnement_espace SET abonnement_stripe=?,termine_definitivement=true WHERE espace_id=?","sub_fixture_"+UUID.randomUUID(),space);
    boolean found=false;
    for(var row:json.readTree(s.get("/api/workspace/owner/subscriptions").body()))if(row.get("spaceId").asLong()==space){found=true;assertTrue(row.get("terminatedSubscription").asBoolean());}
    assertTrue(found);
   } finally {jdbc.update("DELETE FROM abonnement_espace WHERE espace_id=?",space);}
   jdbc.update("INSERT INTO moderation_plateforme(espace_id,acteur_id,action,motif) VALUES (?,?,'SUSPENDRE_ESPACE','Motif de test uniquement')",space,id);
   var actions=s.get("/api/auth/owner-mfa/actions");assertEquals(200,actions.statusCode(),actions.body());
   assertTrue(actions.body().contains("MFA audit fixture"));assertTrue(actions.body().contains("Motif de test uniquement"));
   var alerts=s.get("/api/workspace/owner/dashboard/alerts");assertEquals(200,alerts.statusCode(),alerts.body());
   jdbc.update("INSERT INTO owner_security_event(utilisateur_id,evenement) SELECT ?,'ECHEC' FROM generate_series(1,5)",id);
   var alertData=json.readTree(s.get("/api/workspace/owner/dashboard/alerts").body());assertTrue(alertData.get("failedChecks").asLong()>=5);
   jdbc.update("DELETE FROM owner_security_event WHERE utilisateur_id=? AND evenement='ECHEC'",id);
   var dashboard=s.get("/api/workspace/owner/dashboard");assertEquals(200,dashboard.statusCode(),dashboard.body());
   assertTrue(json.readTree(dashboard.body()).get("unmanagedSpaces").asLong()>=1);
   assertTrue(dashboard.headers().firstValue("Cache-Control").orElse("").contains("no-store"));
   var events=s.get("/api/auth/owner-mfa/events");assertEquals(200,events.statusCode());
   assertTrue(events.headers().firstValue("Cache-Control").orElse("").contains("no-store"));
   assertTrue(events.body().contains("ACTIVATION"));assertFalse(events.body().contains(secret));assertFalse(events.body().contains(backup));
   for(int i=0;i<27;i++)jdbc.update("INSERT INTO owner_security_event(utilisateur_id,evenement) VALUES (?,'ECHEC')",id);
   var page=json.readTree(s.get("/api/auth/owner-mfa/events").body());assertEquals(25,page.get("items").size());assertTrue(page.get("hasMore").asBoolean());
   long cursor=page.get("items").get(24).get("id").asLong();
   var older=json.readTree(s.get("/api/auth/owner-mfa/events?before="+cursor).body());assertTrue(older.get("items").get(0).get("id").asLong()<cursor);
   assertFalse(jdbc.queryForObject("SELECT secret_chiffre FROM owner_second_factor WHERE utilisateur_id=?",String.class,id).contains(secret));
   assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM owner_recovery_code WHERE empreinte=?",Integer.class,backup));
   var other=new Session();assertEquals(401,other.post("/api/auth/login",Map.of("email",email,"password","Incorrect-password-123"),true).statusCode());
   assertEquals(200,other.post("/api/auth/login",Map.of("email",email,"password",password),true).statusCode());
   assertEquals(403,other.get("/api/workspace/owner/finance").statusCode());
   assertEquals(400,other.post("/api/auth/owner-mfa/verify",Map.of("code",OwnerMfaService.totp(decoded,step)),true).statusCode());
   assertEquals(204,other.post("/api/auth/owner-mfa/verify",Map.of("code",OwnerMfaService.totp(decoded,step+1)),true).statusCode());
   assertEquals(200,other.get("/api/workspace/owner/finance").statusCode());
   assertEquals(204,other.post("/api/auth/owner-mfa/verify",Map.of("code",backup,"recovery",true),true).statusCode());
   assertEquals(403,s.get("/api/workspace/owner/finance").statusCode()); // recovery revokes other verified sessions
   assertEquals(400,s.post("/api/auth/owner-mfa/verify",Map.of("code",backup,"recovery",true),true).statusCode());
   for(int i=0;i<4;i++)s.post("/api/auth/owner-mfa/verify",Map.of("code","bad","recovery",true),true);
   assertEquals(429,s.post("/api/auth/owner-mfa/verify",Map.of("code",codes.get(1).asText(),"recovery",true),true).statusCode());
   jdbc.update("UPDATE owner_second_factor SET bloque_jusqua=now()-interval '1 second' WHERE utilisateur_id=?",id);
   var replacement=other.post("/api/auth/owner-mfa/begin",Map.of("password",password),true);
   assertEquals(200,replacement.statusCode());
   byte[] replacementSecret=decode(json.readTree(replacement.body()).get("secret").asText());
   var rotated=other.post("/api/auth/owner-mfa/confirm",Map.of("code",OwnerMfaService.totp(replacementSecret,Instant.now().getEpochSecond()/30)),true);
   assertEquals(200,rotated.statusCode());
   assertEquals(400,s.post("/api/auth/owner-mfa/verify",Map.of("code",codes.get(1).asText(),"recovery",true),true).statusCode());
   assertEquals(200,other.get("/api/workspace/owner/finance").statusCode());
   assertEquals(403,new Session().post("/api/mobile/auth/login",Map.of("email",email,"password",password),false).statusCode());
   String bearer=tokens.issue(accounts.findByEmail(email).orElseThrow());
   var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/workspace/owner/finance")).header("Authorization","Bearer "+bearer).GET().build(),HttpResponse.BodyHandlers.ofString());assertEquals(403,response.statusCode());tokens.revoke(bearer);
   var securityContext=org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
   securityContext.setAuthentication(org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(email,null,List.of()));
   org.springframework.security.core.context.SecurityContextHolder.setContext(securityContext);
   try {
    var session=new org.springframework.mock.web.MockHttpSession();
    session.setAttribute(OwnerMfaService.VERIFIED,jdbc.queryForObject("SELECT version FROM owner_second_factor WHERE utilisateur_id=?",Long.class,id));
    session.setAttribute(OwnerMfaService.VERIFIED_AT,System.currentTimeMillis()-301_000);
    var request=new org.springframework.mock.web.MockHttpServletRequest("POST","/api/workspace/opening-requests/1/decision");
    request.setServletPath("/api/workspace/opening-requests/1/decision");request.setSession(session);
    var deniedResponse=new org.springframework.mock.web.MockHttpServletResponse();
    new OwnerMfaFilter(mfa,ownerSessions).doFilter(request,deniedResponse,(a,b)->fail("Stale verification must not reach the action"));
    assertEquals(403,deniedResponse.getStatus());assertTrue(deniedResponse.getContentAsString().contains("OWNER_REVERIFY_REQUIRED"));
    session.setAttribute(OwnerMfaService.VERIFIED_AT,System.currentTimeMillis());
    var freshResponse=new org.springframework.mock.web.MockHttpServletResponse();var passed=new java.util.concurrent.atomic.AtomicBoolean();
    new OwnerMfaFilter(mfa,ownerSessions).doFilter(request,freshResponse,(a,b)->passed.set(true));assertTrue(passed.get());
   }finally{org.springframework.security.core.context.SecurityContextHolder.clearContext();}
   var active=json.readTree(other.get("/api/auth/owner-mfa/sessions").body());
   assertTrue(active.size()>=2);
   long currentId=0;for(var entry:active)if(entry.get("current").asBoolean())currentId=entry.get("id").asLong();
   assertTrue(currentId>0);
   var keep=other.post("/api/auth/owner-mfa/sessions/"+currentId+"/revoke",Map.of(),true);
   assertEquals(200,keep.statusCode());assertEquals(0,json.readTree(keep.body()).get("revoked").asInt());
   assertEquals(403,s.get("/api/auth/owner-mfa/sessions").statusCode());
   var revoke=other.post("/api/auth/owner-mfa/sessions/revoke-others",Map.of(),true);
   assertEquals(200,revoke.statusCode());assertTrue(json.readTree(revoke.body()).get("revoked").asInt()>0);
   assertEquals(401,s.get("/api/auth/owner-mfa/status").statusCode());
   assertEquals(200,other.get("/api/workspace/owner/finance").statusCode());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM owner_security_event WHERE utilisateur_id=? AND evenement='AUTRES_SESSIONS_REVOQUEES'",Integer.class,id));
   assertEquals(204,other.post("/api/auth/logout",Map.of(),true).statusCode());
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM owner_security_event WHERE utilisateur_id=? AND evenement='DECONNEXION'",Integer.class,id));
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM owner_security_event WHERE utilisateur_id=? AND evenement='CONNEXION_REFUSEE'",Integer.class,id));
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM owner_security_event WHERE utilisateur_id=? AND evenement='MOT_DE_PASSE_VALIDE'",Integer.class,id));
  }finally{
   jdbc.update("DELETE FROM moderation_plateforme WHERE acteur_id=?",id);
   jdbc.update("DELETE FROM espace_organisateur WHERE createur_id=?",id);
   jdbc.update("DELETE FROM owner_web_session WHERE utilisateur_id=?",id);
   jdbc.update("DELETE FROM owner_security_event WHERE utilisateur_id=?",id);jdbc.update("DELETE FROM owner_recovery_code WHERE utilisateur_id=?",id);jdbc.update("DELETE FROM owner_second_factor WHERE utilisateur_id=?",id);jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",id);
   // Tokens remain as revoked audit records; remove only this test account's fixtures.
   jdbc.update("DELETE FROM session_mobile WHERE utilisateur_id=?",id);
   jdbc.update("DELETE FROM utilisateur WHERE id=?",id);
  }
 }
}
