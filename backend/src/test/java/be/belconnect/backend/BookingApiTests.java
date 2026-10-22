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
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class BookingApiTests {
 @LocalServerPort int port;
 @Autowired JdbcTemplate jdbc;
 ObjectMapper json=new ObjectMapper();
 HttpClient client() {return HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();}
 HttpResponse<String> get(HttpClient c,String path) throws Exception {return c.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).build(),HttpResponse.BodyHandlers.ofString());}
 HttpResponse<String> post(HttpClient c,String path,Object data,boolean csrf) throws Exception {
  var b=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Content-Type","application/json");
  if(csrf) {var t=json.readTree(get(c,"/api/auth/csrf").body());b.header(t.get("headerName").asText(),t.get("token").asText());}
  return c.send(b.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(data))).build(),HttpResponse.BodyHandlers.ofString());
 }
 @Test void pendingPaidAttemptIsVisibleInItsOwnersAccount() throws Exception {
  String marker=UUID.randomUUID().toString(), slug="paid-list-"+marker;
  String email="paid-list-"+marker+"@example.com", otherEmail="paid-other-"+marker+"@example.com";
  var owner=client(); var other=client();
  jdbc.update("""
   INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,capacite,places_disponibles,public_cible,rendez_vous,preparation,publiee,demonstration)
   SELECT ?, 'Atelier payant',categorie,ville,lieu,organisateur_nom,55,image,now()+interval '7 days',description,duree,3,3,public_cible,rendez_vous,preparation,true,false
   FROM activite WHERE slug='chocolat'
   """,slug);
  try {
   assertEquals(201,post(owner,"/api/auth/register",Map.of("email",email,"password","Test-password-"+marker,"firstName","Test","lastName","Paiement"),true).statusCode());
   assertEquals(201,post(other,"/api/auth/register",Map.of("email",otherEmail,"password","Test-password-"+marker,"firstName","Test","lastName","Autre"),true).statusCode());
   long userId=jdbc.queryForObject("SELECT id FROM utilisateur WHERE email=?",Long.class,email);
   long activityId=jdbc.queryForObject("SELECT id FROM activite WHERE slug=?",Long.class,slug);
   jdbc.update("""
    INSERT INTO reservation_payante_activite(activite_id,utilisateur_id,demande,quantite,prenom,nom,email,montant_centimes,commission_centimes,compte_stripe)
    VALUES (?,?,?,1,'Test','Paiement',?,5500,440,'acct_testExample123')
    """,activityId,userId,UUID.randomUUID(),email);
   assertEquals(401,get(client(),"/api/paid-activity-bookings").statusCode());
   assertEquals(0,json.readTree(get(other,"/api/paid-activity-bookings").body()).size());
   var attempt=json.readTree(get(owner,"/api/paid-activity-bookings").body());
   assertEquals(1,attempt.size());
   assertEquals("Atelier payant",attempt.get(0).get("title").asText());
   assertEquals("EN_ATTENTE",attempt.get(0).get("status").asText());
   assertTrue(attempt.get(0).get("registrationId").isNull());
  } finally {
   jdbc.update("DELETE FROM reservation_payante_activite WHERE activite_id=(SELECT id FROM activite WHERE slug=?)",slug);
   jdbc.update("DELETE FROM activite WHERE slug=?",slug);
   jdbc.update("DELETE FROM utilisateur WHERE email IN (?,?)",email,otherEmail);
  }
 }
 @Test void reservationIsAtomicPrivateAndValidated() throws Exception {
  String marker=UUID.randomUUID().toString(), slug="booking-test-"+marker;
  String e1="booking-one-"+marker+"@example.com",e2="booking-two-"+marker+"@example.com";
  var c1=client();var c2=client();
  jdbc.update("""
   INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,capacite,places_disponibles,public_cible,rendez_vous,preparation,publiee,demonstration)
   SELECT ?,titre,categorie,ville,lieu,organisateur_nom,0,image,now()+interval '7 days',description,duree,1,1,public_cible,rendez_vous,preparation,true,true FROM activite WHERE slug='chocolat'
   """,slug);
  try {
   for(var entry:Map.of(c1,e1,c2,e2).entrySet()) assertEquals(201,post(entry.getKey(),"/api/auth/register",Map.of("email",entry.getValue(),"password","Test-password-"+marker,"firstName","Test","lastName","Booking"),true).statusCode());
   var body=new HashMap<String,Object>(Map.of("activityId",slug,"quantity",1,"firstName","Test","lastName","Booking","email",e1,"phone","","acknowledged",true));
   assertEquals(401,get(client(),"/api/bookings").statusCode());
   assertEquals(403,post(c1,"/api/bookings",body,false).statusCode());
   var invalid=new HashMap<>(body);invalid.put("quantity",0);
   assertEquals(400,post(c1,"/api/bookings",invalid,true).statusCode());
   invalid.put("quantity",2);assertEquals(409,post(c1,"/api/bookings",invalid,true).statusCode());
   invalid.put("quantity",1);invalid.put("activityId","chocolat");assertEquals(409,post(c1,"/api/bookings",invalid,true).statusCode());
   jdbc.update("UPDATE activite SET publiee=false WHERE slug=?",slug);
   assertEquals(404,post(c1,"/api/bookings",body,true).statusCode());
   jdbc.update("UPDATE activite SET publiee=true,debut=now()-interval '1 day' WHERE slug=?",slug);
   assertEquals(409,post(c1,"/api/bookings",body,true).statusCode());
   jdbc.update("UPDATE activite SET debut=now()+interval '7 days' WHERE slug=?",slug);
   try(var pool=Executors.newFixedThreadPool(2)) {
    var start=new CountDownLatch(1);
    var f1=pool.submit(()->{start.await();return post(c1,"/api/bookings",body,true);});
    var f2=pool.submit(()->{start.await();return post(c2,"/api/bookings",body,true);});start.countDown();
    int s1=f1.get(15,TimeUnit.SECONDS).statusCode(),s2=f2.get(15,TimeUnit.SECONDS).statusCode();
    assertEquals(Set.of(201,409),Set.of(s1,s2));
    var winner=s1==201?c1:c2; var loser=s1==201?c2:c1;
    assertEquals(1,json.readTree(get(winner,"/api/bookings").body()).size());
    assertEquals(0,json.readTree(get(loser,"/api/bookings").body()).size());
    assertEquals(409,post(winner,"/api/bookings",body,true).statusCode());
    long bookingId=json.readTree(get(winner,"/api/bookings").body()).get(0).get("id").asLong();
    String cancelPath="/api/bookings/"+bookingId+"/cancel";
    assertEquals(404,post(loser,cancelPath,Map.of(),true).statusCode());
    assertEquals(401,post(client(),cancelPath,Map.of(),true).statusCode());
    assertEquals(403,post(winner,cancelPath,Map.of(),false).statusCode());
    jdbc.update("UPDATE activite SET debut=now()-interval '1 day' WHERE slug=?",slug);
    assertEquals(409,post(winner,cancelPath,Map.of(),true).statusCode());
    assertEquals(0,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE slug=?",Integer.class,slug));
    jdbc.update("UPDATE activite SET debut=now()+interval '7 days' WHERE slug=?",slug);
    var cancelStart=new CountDownLatch(1);
    var cancel1=pool.submit(()->{cancelStart.await();return post(winner,cancelPath,Map.of(),true);});
    var cancel2=pool.submit(()->{cancelStart.await();return post(winner,cancelPath,Map.of(),true);});
    cancelStart.countDown();
    assertEquals(204,cancel1.get(15,TimeUnit.SECONDS).statusCode());
    assertEquals(204,cancel2.get(15,TimeUnit.SECONDS).statusCode());
    assertEquals(1,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE slug=?",Integer.class,slug));
    assertEquals("ANNULEE",json.readTree(get(winner,"/api/bookings").body()).get(0).get("status").asText());
    assertEquals(201,post(winner,"/api/bookings",body,true).statusCode());
    // Retrying the old cancellation must not release the new booking's place.
    assertEquals(204,post(winner,cancelPath,Map.of(),true).statusCode());

   }
   assertEquals(0,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE slug=?",Integer.class,slug));
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM inscription_activite i JOIN activite a ON a.id=i.activite_id WHERE a.slug=? AND i.statut='CONFIRMEE'",Integer.class,slug));
  } finally {
   jdbc.update("DELETE FROM inscription_activite WHERE activite_id=(SELECT id FROM activite WHERE slug=?)",slug);
   jdbc.update("DELETE FROM activite WHERE slug=?",slug);
   jdbc.update("DELETE FROM utilisateur WHERE email IN (?,?)",e1,e2);
  }
 }
 @Test void modificationsPreserveCapacityOwnershipAndConcurrentChanges() throws Exception {
  String marker=UUID.randomUUID().toString(), slug="modify-test-"+marker;
  String e1="modify-one-"+marker+"@example.com",e2="modify-two-"+marker+"@example.com";
  var c1=client(); var c2=client();
  jdbc.update("""
   INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,capacite,places_disponibles,public_cible,rendez_vous,preparation,publiee,demonstration)
   SELECT ?,titre,categorie,ville,lieu,organisateur_nom,0,image,now()+interval '7 days',description,duree,3,3,public_cible,rendez_vous,preparation,true,true FROM activite WHERE slug='chocolat'
   """,slug);
  try {
   for(var entry:Map.of(c1,e1,c2,e2).entrySet()) assertEquals(201,post(entry.getKey(),"/api/auth/register",Map.of("email",entry.getValue(),"password","Test-password-"+marker,"firstName","Test","lastName","Booking"),true).statusCode());
   var create=Map.of("activityId",slug,"quantity",1,"firstName","Test","lastName","Booking","email",e1,"phone","","acknowledged",true);
   long id1=json.readTree(post(c1,"/api/bookings",create,true).body()).get("id").asLong();
   long id2=json.readTree(post(c2,"/api/bookings",create,true).body()).get("id").asLong();
   String path1="/api/bookings/"+id1+"/modify", path2="/api/bookings/"+id2+"/modify";
   var edit=new HashMap<String,Object>(Map.of("quantity",2,"firstName","Camille","lastName","Updated","email",e2,"phone","+32 470 000 000","version",0));
   assertEquals(404,post(c2,path1,edit,true).statusCode());
   assertEquals(401,post(client(),path1,edit,true).statusCode());
   assertEquals(403,post(c1,path1,edit,false).statusCode());
   var invalid=new HashMap<>(edit); invalid.put("quantity",0);
   assertEquals(400,post(c1,path1,invalid,true).statusCode());
   invalid.put("quantity",5);assertEquals(400,post(c1,path1,invalid,true).statusCode());
   invalid.put("quantity",2);invalid.put("email","invalid");assertEquals(400,post(c1,path1,invalid,true).statusCode());
   invalid=new HashMap<>(edit);invalid.remove("version");assertEquals(400,post(c1,path1,invalid,true).statusCode());
   jdbc.update("UPDATE activite SET debut=now()-interval '1 day' WHERE slug=?",slug);
   assertEquals(409,post(c1,path1,edit,true).statusCode());
   jdbc.update("UPDATE activite SET debut=now()+interval '7 days', publiee=false WHERE slug=?",slug);
   assertEquals(409,post(c1,path1,edit,true).statusCode());
   jdbc.update("UPDATE activite SET publiee=true, prix=10 WHERE slug=?",slug);
   assertEquals(409,post(c1,path1,edit,true).statusCode());
   jdbc.update("UPDATE activite SET prix=0 WHERE slug=?",slug);
   try(var pool=Executors.newFixedThreadPool(2)) {
    var start=new CountDownLatch(1);
    var f1=pool.submit(()->{start.await();return post(c1,path1,edit,true);});
    var f2=pool.submit(()->{start.await();return post(c2,path2,edit,true);});start.countDown();
    int s1=f1.get(15,TimeUnit.SECONDS).statusCode(),s2=f2.get(15,TimeUnit.SECONDS).statusCode();
    assertEquals(Set.of(200,409),Set.of(s1,s2));
    var winner=s1==200?c1:c2;String path=s1==200?path1:path2;long id=s1==200?id1:id2;
    assertEquals(0,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE slug=?",Integer.class,slug));
    assertEquals(409,post(winner,path,edit,true).statusCode());
    var saved=json.readTree(get(winner,"/api/bookings").body()).get(0);
    assertEquals("Camille",saved.get("firstName").asText());assertEquals(e2,saved.get("email").asText());assertEquals(1,saved.get("version").asLong());
    var reduced=new HashMap<>(edit);reduced.put("quantity",1);reduced.put("version",1);
    assertEquals(200,post(winner,path,reduced,true).statusCode());
    assertEquals(1,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE slug=?",Integer.class,slug));
    // Two forms based on the same version: only one may commit, even without a capacity conflict.
    var contacts=new HashMap<>(reduced);contacts.put("version",2);contacts.put("firstName","New name");
    var sameStart=new CountDownLatch(1);
    var g1=pool.submit(()->{sameStart.await();return post(winner,path,contacts,true);});
    var g2=pool.submit(()->{sameStart.await();return post(winner,path,contacts,true);});sameStart.countDown();
    assertEquals(Set.of(200,409),Set.of(g1.get(15,TimeUnit.SECONDS).statusCode(),g2.get(15,TimeUnit.SECONDS).statusCode()));
    assertEquals(1,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE slug=?",Integer.class,slug));
    assertEquals(204,post(winner,"/api/bookings/"+id+"/cancel",Map.of(),true).statusCode());
    contacts.put("version",4);assertEquals(409,post(winner,path,contacts,true).statusCode());
    assertEquals(2,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE slug=?",Integer.class,slug));
   }
  } finally {
   jdbc.update("DELETE FROM inscription_activite WHERE activite_id=(SELECT id FROM activite WHERE slug=?)",slug);
   jdbc.update("DELETE FROM activite WHERE slug=?",slug);
   jdbc.update("DELETE FROM utilisateur WHERE email IN (?,?)",e1,e2);
  }
 }

}
