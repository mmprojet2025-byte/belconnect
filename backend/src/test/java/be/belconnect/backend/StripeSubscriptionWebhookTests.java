package be.belconnect.backend;

import be.belconnect.backend.workspace.StripeSubscriptionWebhookController;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import static org.junit.jupiter.api.Assertions.assertEquals;

@org.springframework.test.context.ActiveProfiles("test")
@TestPropertySource(properties="STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_test_local_subscription")
@SpringBootTest
class StripeSubscriptionWebhookTests {
  @Autowired JdbcTemplate jdbc;
  @Autowired StripeSubscriptionWebhookController webhook;

  private void send(String type,String object) throws Exception {
    String payload="{\"id\":\"evt_"+UUID.randomUUID()+"\",\"object\":\"event\",\"created\":"+(System.currentTimeMillis()/1000)
      +",\"livemode\":false,\"type\":\""+type+"\",\"data\":{\"object\":"+object+"}}";
    long now=System.currentTimeMillis()/1000;
    Mac mac=Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec("whsec_test_local_subscription".getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
    String digest=HexFormat.of().formatHex(mac.doFinal((now+"."+payload).getBytes(StandardCharsets.UTF_8)));
    webhook.receive(payload,"t="+now+",v1="+digest);
  }

  @Test void anOldCheckoutOrActiveUpdateMustNotReactivateACancelledSubscription() throws Exception {
    long user=0,space=0;
    try {
      user=jdbc.queryForObject("INSERT INTO utilisateur(email,mot_de_passe_hash,nom) VALUES (?,'unused-hash','Pilote') RETURNING id",
        Long.class,"subscription-"+UUID.randomUUID()+"@example.test");
      space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Pilote Pro','ASSOCIATION',?) RETURNING id",Long.class,user);
      jdbc.update("""
        INSERT INTO abonnement_espace(espace_id,administrateur_id,formule,statut,session_stripe,abonnement_stripe,client_stripe)
        VALUES (?,?,'PRO','ACTIF','cs_test_subscription123','sub_test_subscription123','cus_test_subscription123')
        """,space,user);
      send("customer.subscription.deleted","{\"id\":\"sub_test_subscription123\",\"object\":\"subscription\",\"status\":\"canceled\"}");
      assertEquals("STARTER",jdbc.queryForObject("SELECT formule FROM abonnement_espace WHERE espace_id=?",String.class,space));
      String checkout="{\"id\":\"cs_test_subscription123\",\"object\":\"checkout.session\","
        +"\"client_reference_id\":\"space-subscription-"+space+"\",\"subscription\":\"sub_test_subscription123\","
        +"\"customer\":\"cus_test_subscription123\",\"mode\":\"subscription\",\"payment_status\":\"paid\","
        +"\"currency\":\"eur\",\"amount_subtotal\":1000}";
      send("checkout.session.completed",checkout);
      send("customer.subscription.updated","{\"id\":\"sub_test_subscription123\",\"object\":\"subscription\",\"status\":\"active\"}");
      assertEquals("ANNULE",jdbc.queryForObject("SELECT statut FROM abonnement_espace WHERE espace_id=?",String.class,space));
      assertEquals("STARTER",jdbc.queryForObject("SELECT formule FROM abonnement_espace WHERE espace_id=?",String.class,space));
    } finally {
      if(space>0) jdbc.update("DELETE FROM abonnement_espace WHERE espace_id=?",space);
      if(space>0) jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
      if(user>0) jdbc.update("DELETE FROM utilisateur WHERE id=?",user);
    }
  }
}
