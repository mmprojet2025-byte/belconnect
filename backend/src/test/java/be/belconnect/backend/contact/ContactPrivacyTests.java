package be.belconnect.backend.contact;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest
class ContactPrivacyTests {
  @Autowired JdbcTemplate jdbc;
  @Autowired OwnerContactFeedbackController controller;

  @Test void statusChangesAreAuditedAndAnonymizationIsIdempotent() {
    String email="contact-owner-"+UUID.randomUUID()+"@example.com";Long owner=null,message=null;
    try {
      owner=jdbc.queryForObject("INSERT INTO utilisateur(email,mot_de_passe_hash,prenom,nom) VALUES (?,'x','Owner','Test') RETURNING id",Long.class,email);
      jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",owner);
      message=jdbc.queryForObject("INSERT INTO message_contact(nom,email,categorie,message,reponse_souhaitee,consentement) VALUES ('Alice','alice@example.com','QUESTION','Message contenant des données personnelles',true,true) RETURNING id",Long.class);
      var auth=UsernamePasswordAuthenticationToken.authenticated(email,"",java.util.List.of());
      var treated=controller.status(auth,message,new OwnerContactFeedbackController.StatusChange("TRAITE"));
      assertEquals("TRAITE",treated.status());assertNotNull(treated.processedAt());
      assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM historique_message_contact WHERE message_id=? AND action='STATUT_MODIFIE'",Integer.class,message));
      var anonymous=controller.anonymize(auth,message);
      assertEquals("ARCHIVE",anonymous.status());assertNull(anonymous.email());assertEquals("[Contenu anonymisé]",anonymous.message());assertNotNull(anonymous.anonymizedAt());
      controller.anonymize(auth,message);
      assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM historique_message_contact WHERE message_id=? AND action='ANONYMISE'",Integer.class,message));
    } finally {
      if(message!=null) jdbc.update("DELETE FROM message_contact WHERE id=?",message);
      if(owner!=null) { jdbc.update("DELETE FROM role_plateforme WHERE utilisateur_id=?",owner);jdbc.update("DELETE FROM utilisateur WHERE id=?",owner); }
    }
  }
}
