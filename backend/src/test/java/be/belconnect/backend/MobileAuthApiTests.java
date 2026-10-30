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

  HttpResponse<String> api(String method,String path,Object body,String token) throws Exception {
    var builder=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Accept","application/json").header("Authorization","Bearer "+token);
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

  @Test void mobileTokenCanCreateListAndCancelBooking() throws Exception {
    String marker=UUID.randomUUID().toString(),email="mobile-booking-"+marker+"@example.com",slug="mobile-booking-"+marker;
    jdbc.update("""
      INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,capacite,places_disponibles,public_cible,rendez_vous,preparation,publiee,demonstration)
      SELECT ?, 'Balade mobile',categorie,ville,lieu,organisateur_nom,0,image,now()+interval '7 days',description,duree,3,3,public_cible,rendez_vous,preparation,true,true
      FROM activite WHERE slug='chocolat'
      """,slug);
    try {
      var created=request("POST","register",Map.of("email",email,"password","Mobile-booking-"+marker,"firstName","Nora","lastName","Mobile"),null);
      assertEquals(201,created.statusCode(),created.body());
      String token=json.readTree(created.body()).get("token").asText();
      UUID deviceId=UUID.randomUUID();
      assertEquals(204,api("POST","/api/mobile/devices",Map.of("deviceId",deviceId.toString(),"expoPushToken","ExpoPushToken[test_mobile_token]","platform","ios"),token).statusCode());
      assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM appareil_push_mobile WHERE id_appareil=?",Integer.class,deviceId));
      assertEquals(0,json.readTree(api("GET","/api/mobile/notifications",null,token).body()).size());
      var body=Map.of("activityId",slug,"quantity",2,"firstName","Nora","lastName","Mobile","email",email,"phone","","acknowledged",true);
      var booking=api("POST","/api/bookings",body,token);
      assertEquals(201,booking.statusCode(),booking.body());
      long id=json.readTree(booking.body()).get("id").asLong();
      var listed=json.readTree(api("GET","/api/bookings",null,token).body());
      assertEquals(1,listed.size());assertEquals(2,listed.get(0).get("quantity").asInt());
      assertEquals(204,api("POST","/api/bookings/"+id+"/cancel",Map.of(),token).statusCode());
      assertEquals("ANNULEE",json.readTree(api("GET","/api/bookings",null,token).body()).get(0).get("status").asText());
      assertEquals(3,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE slug=?",Integer.class,slug));
      long userId=jdbc.queryForObject("SELECT id FROM utilisateur WHERE email=?",Long.class,email);
      long activityId=jdbc.queryForObject("SELECT id FROM activite WHERE slug=?",Long.class,slug);
      jdbc.update("""
        INSERT INTO reservation_payante_activite(activite_id,utilisateur_id,demande,quantite,prenom,nom,email,montant_centimes,commission_centimes,compte_stripe)
        VALUES (?,?,?,1,'Nora','Mobile',?,2500,200,'acct_testExample123')
        """,activityId,userId,UUID.randomUUID(),email);
      var attempts=json.readTree(api("GET","/api/paid-activity-bookings",null,token).body());
      assertEquals(1,attempts.size());assertEquals("EN_ATTENTE",attempts.get(0).get("status").asText());
    } finally {
      jdbc.update("DELETE FROM reservation_payante_activite WHERE activite_id=(SELECT id FROM activite WHERE slug=?)",slug);
      jdbc.update("DELETE FROM inscription_activite WHERE activite_id=(SELECT id FROM activite WHERE slug=?)",slug);
      jdbc.update("DELETE FROM activite WHERE slug=?",slug);
      jdbc.update("DELETE FROM utilisateur WHERE email=?",email);
    }
  }

  @Test void readActivityCancellationRemainsInMobileHistory() throws Exception {
    String marker=UUID.randomUUID().toString(),email="mobile-notice-"+marker+"@example.com",slug="mobile-notice-"+marker;
    jdbc.update("""
      INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,capacite,places_disponibles,public_cible,rendez_vous,preparation,publiee,demonstration)
      SELECT ?, 'Balade annulée',categorie,ville,lieu,organisateur_nom,0,image,now()+interval '7 days',description,duree,3,3,public_cible,rendez_vous,preparation,true,true
      FROM activite WHERE slug='chocolat'
      """,slug);
    try {
      var created=request("POST","register",Map.of("email",email,"password","Mobile-notice-"+marker,"firstName","Nora","lastName","Mobile"),null);
      assertEquals(201,created.statusCode(),created.body());
      String token=json.readTree(created.body()).get("token").asText();
      var booking=api("POST","/api/bookings",Map.of("activityId",slug,"quantity",1,"firstName","Nora","lastName","Mobile","email",email,"phone","","acknowledged",true),token);
      assertEquals(201,booking.statusCode(),booking.body());
      long registrationId=json.readTree(booking.body()).get("id").asLong();
      long userId=jdbc.queryForObject("SELECT id FROM utilisateur WHERE email=?",Long.class,email);
      long activityId=jdbc.queryForObject("SELECT id FROM activite WHERE slug=?",Long.class,slug);
      jdbc.update("INSERT INTO notification_activite(utilisateur_id,inscription_id,activite_id) VALUES (?,?,?)",userId,registrationId,activityId);
      var unread=json.readTree(api("GET","/api/mobile/notifications",null,token).body());
      assertEquals(1,unread.size());
      assertEquals(activityId,unread.get(0).get("activityId").asLong());
      assertTrue(unread.get(0).get("readAt").isNull());
      assertEquals(204,api("POST","/api/mobile/notifications/activity/"+unread.get(0).get("id").asLong()+"/read",Map.of(),token).statusCode());
      var history=json.readTree(api("GET","/api/mobile/notifications",null,token).body());
      assertEquals(1,history.size());
      assertFalse(history.get(0).get("readAt").isNull());
    } finally {
      jdbc.update("DELETE FROM notification_activite WHERE activite_id=(SELECT id FROM activite WHERE slug=?)",slug);
      jdbc.update("DELETE FROM inscription_activite WHERE activite_id=(SELECT id FROM activite WHERE slug=?)",slug);
      jdbc.update("DELETE FROM activite WHERE slug=?",slug);
      jdbc.update("DELETE FROM utilisateur WHERE email=?",email);
    }
  }
}
