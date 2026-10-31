package be.belconnect.backend;

import be.belconnect.backend.booking.PaidActivityCancellation;
import be.belconnect.backend.booking.PaidActivitySettlement;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@org.springframework.test.context.ActiveProfiles("test")
@TestPropertySource(properties="STRIPE_WEBHOOK_SECRET=whsec_test_local_only")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProjectDonationApiTests {
  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired be.belconnect.backend.billing.SpaceCommission commissions;
  @Autowired TransactionTemplate tx;
  @Autowired PaidActivitySettlement paidActivitySettlement;
  final ObjectMapper json=new ObjectMapper();
  final List<Long> users=new ArrayList<>();
  long space,project,donation,activity;
  class Actor {
    final HttpClient client=HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build();
    HttpResponse<String> get(String path) throws Exception {
      return client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).GET().build(),HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> post(String path,Object body,boolean csrf) throws Exception {
      var request=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Content-Type","application/json");
      if(csrf) { var token=json.readTree(get("/api/auth/csrf").body()); request.header(token.get("headerName").asText(),token.get("token").asText()); }
      return client.send(request.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
    }
  }
  Actor actor() throws Exception {
    var actor=new Actor();
    var response=actor.post("/api/auth/register",Map.of("firstName","Noor","lastName","Donateur", "email","donor-"+UUID.randomUUID()+"@example.com","password","Test-password-"+UUID.randomUUID()),true);
    assertEquals(201,response.statusCode(),response.body());
    users.add(json.readTree(response.body()).get("id").asLong());
    return actor;
  }
  void setupData() {
    space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id,stripe_account_id) VALUES ('Projet solidaire','ASSOCIATION',?,'acct_testExample123') RETURNING id",Long.class,users.getFirst());
    project=jdbc.queryForObject("""
      INSERT INTO projet(espace_id,auteur_id,titre,description,objectif,statut,publie,visibilite)
      VALUES (?,?,'Projet de quartier','Rassembler les voisins','Un atelier ouvert','APPROUVE',true,'PUBLIQUE') RETURNING id
      """,Long.class,space,users.getFirst());
    donation=jdbc.queryForObject("""
      INSERT INTO don_projet(projet_id,donateur_id,demande,montant_centimes,commission_centimes,compte_stripe,session_stripe)
      VALUES (?,?,?,1000,50,'acct_testExample123','cs_test_donation123') RETURNING id
      """,Long.class,project,users.getFirst(),UUID.randomUUID());
  }
  void cleanup() {
    if(activity>0) {
      jdbc.update("DELETE FROM notification_activite WHERE activite_id=?",activity);
      jdbc.update("DELETE FROM reservation_payante_activite WHERE activite_id=?",activity);
      jdbc.update("DELETE FROM inscription_activite WHERE activite_id=?",activity);
      jdbc.update("DELETE FROM activite WHERE id=?",activity);
      activity=0;
    }
    if(project>0) {
      jdbc.update("DELETE FROM inscription_gratuite_projet WHERE projet_id=?",project);
      jdbc.update("DELETE FROM inscription_payante_projet WHERE projet_id=?",project);
      jdbc.update("DELETE FROM offre_participation_projet WHERE projet_id=?",project);
    }
    if(donation>0) jdbc.update("DELETE FROM don_projet WHERE id=?",donation);
    if(project>0) jdbc.update("DELETE FROM projet WHERE id=?",project);
    if(space>0) jdbc.update("DELETE FROM appartenance_espace WHERE espace_id=?",space);
    if(space>0) jdbc.update("DELETE FROM abonnement_espace WHERE espace_id=?",space);
    if(space>0) jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
    for(long id:users) jdbc.update("DELETE FROM utilisateur WHERE id=?",id);
  }
  @Test void freeLongProjectEnrollmentRespectsCapacityAndAppearsInAccount() throws Exception {
    try {
      actor(); setupData(); var first=actor(); var second=actor(); var third=actor();
      jdbc.update("""
        INSERT INTO offre_participation_projet(projet_id,description,prix_centimes,capacite,debut_action,lieu_action)
        VALUES (?, 'Voyage collectif sur plusieurs jours', 0, 2, now()+interval '10 days', 'Gare de Bruxelles-Central')
        """,project);
      var offer=json.readTree(first.get("/api/project-paid-participations/offer/"+project).body());
      assertEquals(0,offer.get("priceCents").asInt()); assertTrue(offer.get("paymentReady").asBoolean());
      String path="/api/project-paid-participations/free/"+project;
      var joined=first.post(path,Map.of(),true); assertEquals(200,joined.statusCode(),joined.body());
      long enrollment=json.readTree(joined.body()).get("id").asLong();
      assertEquals(enrollment,json.readTree(first.post(path,Map.of(),true).body()).get("id").asLong());
      assertEquals(1,json.readTree(first.get("/api/project-paid-participations/free").body()).size());
      assertEquals(200,second.post(path,Map.of(),true).statusCode());
      assertEquals(409,third.post(path,Map.of(),true).statusCode());
      assertEquals(0,json.readTree(first.get("/api/project-paid-participations/offer/"+project).body()).get("placesLeft").asInt());
      assertEquals(200,first.post("/api/project-paid-participations/free/"+enrollment+"/cancel",Map.of(),true).statusCode());
      assertEquals(200,third.post(path,Map.of(),true).statusCode());
    } finally { cleanup(); }
  }
  @Test void publishedProjectWithoutOfferAllowsSimpleFreeEnrollment() throws Exception {
    try {
      actor(); setupData(); var participant=actor();
      String path="/api/project-paid-participations/free/"+project;
      assertEquals(404,participant.get("/api/project-paid-participations/offer/"+project).statusCode());
      var joined=participant.post(path,Map.of(),true);
      assertEquals(200,joined.statusCode(),joined.body());
      long enrollment=json.readTree(joined.body()).get("id").asLong();
      assertEquals(enrollment,json.readTree(participant.post(path,Map.of(),true).body()).get("id").asLong());
      assertEquals(1,json.readTree(participant.get("/api/project-paid-participations/free").body()).size());
      assertEquals(200,participant.post("/api/project-paid-participations/free/"+enrollment+"/cancel",Map.of(),true).statusCode());
      assertEquals(200,participant.post(path,Map.of(),true).statusCode());
      jdbc.update("UPDATE projet SET publie=false WHERE id=?",project);
      assertEquals(200,participant.post("/api/project-paid-participations/free/"+enrollment+"/cancel",Map.of(),true).statusCode());
      assertEquals(404,participant.post(path,Map.of(),true).statusCode());
    } finally { cleanup(); }
  }
  @Test void publicCanReadPaidProjectOfferWithoutAccessToManagement() throws Exception {
    try {
      actor(); setupData();
      jdbc.update("INSERT INTO offre_participation_projet(projet_id,description,prix_centimes,capacite) VALUES (?,?,?,?)",
          project,"Une place pour une activité du projet.",1200,16);
      var visitor=new Actor();
      var offer=visitor.get("/api/project-paid-participations/offer/"+project);
      assertEquals(200,offer.statusCode(),offer.body());
      assertEquals(1200,json.readTree(offer.body()).get("priceCents").asInt());
      var publicProject=visitor.get("/api/projects/"+project);
      assertEquals(200,publicProject.statusCode(),publicProject.body());
      assertEquals(1200,json.readTree(publicProject.body()).get("participationPriceCents").asInt());
      assertEquals(401,visitor.get("/api/project-paid-participations/manage/"+project).statusCode());
    } finally { cleanup(); }
  }
  @Test void paidActivityNeedsSignedMatchingPaymentAndConfirmsOnlyOnce() throws Exception {
    try {
      var participant=actor(); var stranger=actor(); setupData();
      activity=jdbc.queryForObject("""
        INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,
          capacite,places_disponibles,public_cible,rendez_vous,preparation,publiee,espace_id)
        VALUES (?,'Atelier payant','art','Bruxelles','Maison du quartier','Projet solidaire',12.50,'ceramique',
          now()+interval '7 days','Atelier collectif','2 heures',2,2,'Adultes','Accueil','',true,?) RETURNING id
        """,Long.class,"atelier-payant-"+UUID.randomUUID(),space);
      long attempt=jdbc.queryForObject("""
        INSERT INTO reservation_payante_activite(activite_id,utilisateur_id,demande,quantite,prenom,nom,email,
          montant_centimes,commission_centimes,compte_stripe,session_stripe)
        VALUES (?,?,?,2,'Noor','Donateur','test@example.com',2500,200,'acct_testExample123','cs_test_activity123') RETURNING id
        """,Long.class,activity,users.getFirst(),UUID.randomUUID());
      String slug=jdbc.queryForObject("SELECT slug FROM activite WHERE id=?",String.class,activity);
      assertEquals(0,json.readTree(participant.get("/api/activities/"+slug).body()).get("details").get("remaining").asInt());
      assertEquals(404,stranger.get("/api/paid-activity-bookings/"+attempt).statusCode());
      assertEquals("EN_ATTENTE",json.readTree(participant.get("/api/paid-activity-bookings/"+attempt).body()).get("status").asText());
      String event=event("checkout.session.completed",2500,"paid")
        .replace("cs_test_donation123","cs_test_activity123")
        .replace("\"client_reference_id\":\""+donation+"\"","\"client_reference_id\":\"activity-booking-"+attempt+"\"");
      assertEquals(400,webhook(event,false).statusCode());
      assertEquals(204,webhook(event.replace("\"amount_total\":2500","\"amount_total\":2400"),true).statusCode());
      assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM inscription_activite WHERE activite_id=?",Integer.class,activity));
      assertEquals(204,webhook(event,true).statusCode());
      assertEquals(204,webhook(event,true).statusCode());
      assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM inscription_activite WHERE activite_id=?",Integer.class,activity));
      assertEquals(0,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE id=?",Integer.class,activity));
      assertEquals("PAYE",jdbc.queryForObject("SELECT statut FROM reservation_payante_activite WHERE id=?",String.class,attempt));
    } finally { cleanup(); }
  }
  @Test void organizerRefundWaitsForStripeSuccessBeforeCancellingPaidBookings() throws Exception {
    try {
      var participant=actor(); setupData();
      activity=jdbc.queryForObject("""
        INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,
          capacite,places_disponibles,public_cible,rendez_vous,preparation,annulee,date_annulation,espace_id)
        VALUES (?,'Atelier annulé','art','Bruxelles','Maison du quartier','Projet solidaire',12.50,'ceramique',
          now()+interval '7 days','Atelier collectif','2 heures',2,0,'Adultes','Accueil','',true,now(),?) RETURNING id
        """,Long.class,"atelier-remboursement-"+UUID.randomUUID(),space);
      long registration=jdbc.queryForObject("""
        INSERT INTO inscription_activite(utilisateur_id,activite_id,quantite,prenom,nom,email)
        VALUES (?,?,2,'Noor','Donateur','test@example.com') RETURNING id
        """,Long.class,users.getFirst(),activity);
      long attempt=jdbc.queryForObject("""
        INSERT INTO reservation_payante_activite(activite_id,utilisateur_id,demande,quantite,prenom,nom,email,
          montant_centimes,commission_centimes,compte_stripe,session_stripe,paiement_stripe,inscription_id,statut)
        VALUES (?,?,?,2,'Noor','Donateur','test@example.com',2500,200,'acct_testExample123',
          'cs_test_refund123','pi_test_refund123',?,'PAYE') RETURNING id
        """,Long.class,activity,users.getFirst(),UUID.randomUUID(),registration);
      var service=new PaidActivityCancellation(jdbc,tx,paidActivitySettlement,"sk_test_local_only");
      Refund pending=mock(Refund.class),success=mock(Refund.class);
      when(pending.getId()).thenReturn("re_test_refund123");
      when(pending.getStatus()).thenReturn("pending");
      when(pending.getAmount()).thenReturn(2500L);
      when(pending.getCurrency()).thenReturn("eur");
      when(pending.getPaymentIntent()).thenReturn("pi_test_refund123");
      when(success.getId()).thenReturn("re_test_refund123");
      when(success.getStatus()).thenReturn("succeeded");
      when(success.getAmount()).thenReturn(2500L);
      when(success.getCurrency()).thenReturn("eur");
      when(success.getPaymentIntent()).thenReturn("pi_test_refund123");
      try(var stripe=mockStatic(Refund.class)) {
        stripe.when(()->Refund.create(any(RefundCreateParams.class),any(RequestOptions.class))).thenReturn(pending);
        stripe.when(()->Refund.retrieve(eq("re_test_refund123"),any(RequestOptions.class))).thenReturn(success);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.process(activity));
        assertEquals("REMBOURSEMENT_EN_COURS",jdbc.queryForObject("SELECT statut FROM reservation_payante_activite WHERE id=?",String.class,attempt));
        assertEquals("CONFIRMEE",jdbc.queryForObject("SELECT statut FROM inscription_activite WHERE id=?",String.class,registration));
        assertEquals("REMBOURSEMENT_EN_COURS",json.readTree(participant.get("/api/bookings").body()).get(0).get("paymentStatus").asText());
        service.process(activity);
        stripe.verify(()->Refund.create(any(RefundCreateParams.class),any(RequestOptions.class)),times(1));
      }
      assertEquals("REMBOURSE",jdbc.queryForObject("SELECT statut FROM reservation_payante_activite WHERE id=?",String.class,attempt));
      assertEquals("ANNULEE",jdbc.queryForObject("SELECT statut FROM inscription_activite WHERE id=?",String.class,registration));
      assertEquals(2,jdbc.queryForObject("SELECT places_disponibles FROM activite WHERE id=?",Integer.class,activity));
      assertEquals("REMBOURSE",json.readTree(participant.get("/api/bookings").body()).get(0).get("paymentStatus").asText());
    } finally { cleanup(); }
  }
  @Test void paidActivityCannotUseFreeCancellationOrCloseWithoutStripe() throws Exception {
    try {
      var organizer=actor(); var stranger=actor(); setupData();
      jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,'ADMINISTRATEUR')",users.getFirst(),space);
      activity=jdbc.queryForObject("""
        INSERT INTO activite(slug,titre,categorie,ville,lieu,organisateur_nom,prix,image,debut,description,duree,
          capacite,places_disponibles,public_cible,rendez_vous,preparation,publiee,espace_id,cloture_inscriptions)
        VALUES (?,'Atelier payant','art','Bruxelles','Maison du quartier','Projet solidaire',12.50,'ceramique',
          now()+interval '7 days','Atelier collectif','2 heures',2,2,'Adultes','Accueil','',false,?,now()+interval '6 days') RETURNING id
        """,Long.class,"atelier-garde-"+UUID.randomUUID(),space);
      String path="/api/managed-activities/"+activity;
      jdbc.update("UPDATE activite SET prix=0.01 WHERE id=?",activity);
      assertEquals(409,organizer.post(path+"/publication",Map.of("version",0,"published",true),true).statusCode());
      jdbc.update("UPDATE activite SET prix=12.50 WHERE id=?",activity);
      assertEquals(503,organizer.post(path+"/publication",Map.of("version",0,"published",true),true).statusCode());
      jdbc.update("UPDATE activite SET publiee=true WHERE id=?",activity);
      assertEquals(403,stranger.post(path+"/cancel-paid",Map.of("version",0),true).statusCode());
      assertEquals(409,organizer.post(path+"/cancel",Map.of("version",0),true).statusCode());
      assertEquals(503,organizer.post(path+"/cancel-paid",Map.of("version",0),true).statusCode());
      assertTrue(jdbc.queryForObject("SELECT publiee FROM activite WHERE id=?",Boolean.class,activity));
      assertFalse(jdbc.queryForObject("SELECT annulee FROM activite WHERE id=?",Boolean.class,activity));
    } finally { cleanup(); }
  }
  @Test void organizerPlanChangesTheDisplayedCommissionForDonationsAndPaidProjects() throws Exception {
    try {
      var donor=actor(); setupData();
      jdbc.update("INSERT INTO offre_participation_projet(projet_id,description,prix_centimes,capacite) VALUES (?,'Rencontre participative du quartier',2000,3)",project);
      assertEquals(80,commissions.cents(space,1000));
      assertEquals(8,json.readTree(donor.get("/api/project-donations/availability?projectId="+project).body()).get("commissionPercent").asInt());
      assertEquals(8,json.readTree(donor.get("/api/project-paid-participations/offer/"+project).body()).get("commissionPercent").asInt());
      jdbc.update("INSERT INTO abonnement_espace(espace_id,administrateur_id,formule,statut) VALUES (?,?,'PRO','ACTIF')",space,users.getFirst());
      assertEquals(50,commissions.cents(space,1000));
      assertEquals(5,json.readTree(donor.get("/api/project-donations/availability?projectId="+project).body()).get("commissionPercent").asInt());
      assertEquals(5,json.readTree(donor.get("/api/project-paid-participations/offer/"+project).body()).get("commissionPercent").asInt());
      jdbc.update("UPDATE abonnement_espace SET statut='ANNULE',formule='STARTER' WHERE espace_id=?",space);
      assertEquals(8,json.readTree(donor.get("/api/project-paid-participations/offer/"+project).body()).get("commissionPercent").asInt());
    } finally { cleanup(); }
  }
  @Test void paidParticipationRequiresSignedMatchingCheckoutAndKeepsOnePlace() throws Exception {
    try {
      var participant=actor(); var other=actor(); setupData();
      jdbc.update("INSERT INTO offre_participation_projet(projet_id,description,prix_centimes,capacite) VALUES (?,'Atelier collectif de quartier',2000,1)",project);
      long booking=jdbc.queryForObject("""
        INSERT INTO inscription_payante_projet(projet_id,participant_id,demande,prix_centimes,commission_centimes,compte_stripe,session_stripe)
        VALUES (?,?,?,2000,100,'acct_testExample123','cs_test_paidproject123') RETURNING id
        """,Long.class,project,users.getFirst(),UUID.randomUUID());
      var available=json.readTree(participant.get("/api/project-paid-participations/offer/"+project).body());
      assertEquals(0,available.get("placesLeft").asInt());
      assertEquals(404,other.get("/api/project-paid-participations/"+booking).statusCode());
      assertEquals(503,participant.post("/api/project-paid-participations",Map.of("requestId",UUID.randomUUID(),"projectId",project),true).statusCode());
      String base=event("checkout.session.completed",2000,"paid")
        .replace("cs_test_donation123","cs_test_paidproject123")
        .replace("\"client_reference_id\":\""+donation+"\"","\"client_reference_id\":\"project-participation-"+booking+"\"");
      assertEquals(400,webhook(base,false).statusCode());
      assertEquals(204,webhook(base.replace("\"amount_total\":2000","\"amount_total\":1900"),true).statusCode());
      assertEquals("EN_ATTENTE",jdbc.queryForObject("SELECT statut FROM inscription_payante_projet WHERE id=?",String.class,booking));
      assertEquals(204,webhook(base,true).statusCode());
      assertEquals(204,webhook(base,true).statusCode());
      assertEquals("PAYE",jdbc.queryForObject("SELECT statut FROM inscription_payante_projet WHERE id=?",String.class,booking));
      assertEquals(0,json.readTree(participant.get("/api/project-paid-participations/offer/"+project).body()).get("placesLeft").asInt());
    } finally { cleanup(); }
  }
  @Test void aPendingStripeProjectPaymentKeepsTheLastPlaceAfterTheLocalDeadline() throws Exception {
    try {
      var participant=actor(); setupData();
      jdbc.update("INSERT INTO offre_participation_projet(projet_id,description,prix_centimes,capacite) VALUES (?,'Une séance de quartier à confirmer',2000,1)",project);
      long booking=jdbc.queryForObject("""
        INSERT INTO inscription_payante_projet(projet_id,participant_id,demande,prix_centimes,commission_centimes,
          compte_stripe,session_stripe,expiration)
        VALUES (?,?,?,2000,160,'acct_testExample123','cs_test_lateproject123',now()-interval '1 minute') RETURNING id
        """,Long.class,project,users.getFirst(),UUID.randomUUID());
      assertEquals(0,json.readTree(participant.get("/api/project-paid-participations/offer/"+project).body()).get("placesLeft").asInt(),
        "Une place ne doit pas être revendue tant que Stripe n'a pas confirmé l'expiration ou l'échec.");
      String paid=event("checkout.session.completed",2000,"paid")
        .replace("cs_test_donation123","cs_test_lateproject123")
        .replace("\"client_reference_id\":\""+donation+"\"","\"client_reference_id\":\"project-participation-"+booking+"\"");
      assertEquals(204,webhook(paid,true).statusCode());
      assertEquals("PAYE",jdbc.queryForObject("SELECT statut FROM inscription_payante_projet WHERE id=?",String.class,booking));
      assertEquals(0,json.readTree(participant.get("/api/project-paid-participations/offer/"+project).body()).get("placesLeft").asInt());
    } finally { cleanup(); }
  }
  @Test void aPublicProjectLinkedToAGroupKeepsItsPaidOfferPublic() throws Exception {
    long group=0;
    try {
      actor(); setupData();
      group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom) VALUES (?,'Groupe pilote') RETURNING id",Long.class,space);
      jdbc.update("UPDATE projet SET groupe_id=? WHERE id=?",group,project);
      jdbc.update("INSERT INTO offre_participation_projet(projet_id,description,prix_centimes,capacite) VALUES (?,'Une séance du projet ouverte au public',2000,2)",project);
      var visitor=new Actor();
      assertEquals(200,visitor.get("/api/projects/"+project).statusCode());
      assertEquals(200,visitor.get("/api/project-paid-participations/offer/"+project).statusCode());
      jdbc.update("UPDATE projet SET visibilite='GROUPE' WHERE id=?",project);
      assertEquals(404,visitor.get("/api/projects/"+project).statusCode());
      assertEquals(404,visitor.get("/api/project-paid-participations/offer/"+project).statusCode());
    } finally {
      if(group>0) jdbc.update("UPDATE projet SET visibilite='PUBLIQUE',groupe_id=NULL WHERE id=?",project);
      if(group>0) jdbc.update("DELETE FROM groupe WHERE id=?",group);
      cleanup();
    }
  }
  @Test void aPaymentConfirmedAfterTheOfferClosesRemainsQueuedForFullRefund() throws Exception {
    try {
      actor(); setupData();
      jdbc.update("INSERT INTO offre_participation_projet(projet_id,description,prix_centimes,capacite,active) VALUES (?,'Séance annulée mais payée',2000,1,false)",project);
      long booking=jdbc.queryForObject("""
        INSERT INTO inscription_payante_projet(projet_id,participant_id,demande,prix_centimes,commission_centimes,
          compte_stripe,session_stripe,statut)
        VALUES (?,?,?,2000,160,'acct_testExample123','cs_test_cancelledproject123','EN_ATTENTE') RETURNING id
        """,Long.class,project,users.getFirst(),UUID.randomUUID());
      String paid=event("checkout.session.completed",2000,"paid")
        .replace("cs_test_donation123","cs_test_cancelledproject123")
        .replace("\"client_reference_id\":\""+donation+"\"","\"client_reference_id\":\"project-participation-"+booking+"\"");
      assertEquals(204,webhook(paid,true).statusCode());
      assertEquals("REMBOURSEMENT_EN_COURS",jdbc.queryForObject("SELECT statut FROM inscription_payante_projet WHERE id=?",String.class,booking));
    } finally { cleanup(); }
  }
  String event(String type,long amount,String paymentStatus) {
    return """
      {"id":"evt_test_donation","object":"event","created":%d,"livemode":false,"type":"%s",
       "data":{"object":{"id":"cs_test_donation123","object":"checkout.session",
       "client_reference_id":"%d","amount_total":%d,"currency":"eur",
       "payment_status":"%s","payment_intent":"pi_test_donation123"}}}
      """.formatted(System.currentTimeMillis()/1000,type,donation,amount,paymentStatus);
  }
  HttpResponse<String> webhook(String payload,boolean valid) throws Exception {
    long timestamp=System.currentTimeMillis()/1000;
    Mac mac=Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec("whsec_test_local_only".getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
    String digest=HexFormat.of().formatHex(mac.doFinal((timestamp+"."+payload).getBytes(StandardCharsets.UTF_8)));
    String signature="t="+timestamp+",v1="+(valid?digest:"0".repeat(64));
    var request=HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/stripe/webhook"))
      .header("Content-Type","application/json").header("Stripe-Signature",signature)
      .POST(HttpRequest.BodyPublishers.ofString(payload)).build();
    return HttpClient.newHttpClient().send(request,HttpResponse.BodyHandlers.ofString());
  }
  @Test void donationIsPrivateAndOnlySignedMatchingWebhooksConfirmIt() throws Exception {
    try {
      var donor=actor(); var stranger=actor(); setupData();
      assertEquals(401,new Actor().get("/api/project-donations/"+donation).statusCode());
      assertEquals(404,stranger.get("/api/project-donations/"+donation).statusCode());
      assertEquals("EN_ATTENTE",json.readTree(donor.get("/api/project-donations/"+donation).body()).get("status").asText());
      assertEquals(1,json.readTree(donor.get("/api/project-donations").body()).size());
      assertEquals(0,json.readTree(stranger.get("/api/project-donations").body()).size());
      assertEquals(503,donor.post("/api/project-donations",Map.of("requestId",UUID.randomUUID(),"projectId",project,"amountCents",1000),true).statusCode());
      assertEquals(400,webhook(event("checkout.session.completed",1000,"paid"),false).statusCode());
      assertEquals(204,webhook(event("checkout.session.completed",900,"paid"),true).statusCode());
      assertEquals("EN_ATTENTE",json.readTree(donor.get("/api/project-donations/"+donation).body()).get("status").asText());
      assertEquals(204,webhook(event("checkout.session.completed",1000,"unpaid"),true).statusCode());
      assertEquals("EN_ATTENTE",json.readTree(donor.get("/api/project-donations/"+donation).body()).get("status").asText());
      assertEquals(204,webhook(event("checkout.session.async_payment_succeeded",1000,"paid"),true).statusCode());
      assertEquals(204,webhook(event("checkout.session.async_payment_succeeded",1000,"paid"),true).statusCode());
      assertEquals(204,webhook(event("checkout.session.expired",1000,"unpaid"),true).statusCode());
      assertEquals("PAYE",json.readTree(donor.get("/api/project-donations/"+donation).body()).get("status").asText());
    } finally { cleanup(); }
  }
}
