package be.belconnect.backend.workspace;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MemberInterventionTests {
 @Autowired JdbcTemplate jdbc;
 @Autowired MemberInterventionController controller;
 long user(){return jdbc.queryForObject("INSERT INTO utilisateur(email,mot_de_passe_hash,nom) VALUES (?,'unused','Fixture') RETURNING id",Long.class,UUID.randomUUID()+"@example.com");}
 Authentication auth(long id){return new UsernamePasswordAuthenticationToken(jdbc.queryForObject("SELECT email FROM utilisateur WHERE id=?",String.class,id),null);}
 long space(long owner){return jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES ('Fixture','ORGANISATEUR',?) RETURNING id",Long.class,owner);}
 void membership(long u,long s,String role){jdbc.update("INSERT INTO appartenance_espace(utilisateur_id,espace_id,role) VALUES (?,?,?)",u,s,role);}
 String status(long u,long s){return jdbc.queryForObject("SELECT statut FROM appartenance_espace WHERE utilisateur_id=? AND espace_id=?",String.class,u,s);}
 void denied(int code,Runnable action){assertEquals(code,assertThrows(ResponseStatusException.class,action::run).getStatusCode().value());}
 @Test void approvalIsRequiredAndOnlyChangesTheRequestedSpace(){
  long owner=user(),admin=user(),member=user(),outsider=user(),s=space(owner),other=space(owner);
  jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",owner);
  membership(admin,s,"ADMINISTRATEUR");membership(outsider,other,"ADMINISTRATEUR");membership(member,s,"MEMBRE");membership(member,other,"MEMBRE");
  var request=new MemberInterventionController.Request(s,null,member,"Motif suffisamment détaillé");
  denied(403,()->controller.create(auth(member),request));
  controller.create(auth(owner),request);
  assertEquals("ACTIF",status(member,s));
  denied(409,()->controller.create(auth(owner),request));
  long id=jdbc.queryForObject("SELECT id FROM demande_intervention_membre WHERE cible_id=?",Long.class,member);
  var decision=new MemberInterventionController.Decision(true,"Décision motivée de l’administrateur");
  denied(403,()->controller.decide(auth(owner),id,decision));
  denied(403,()->controller.decide(auth(outsider),id,decision));
  denied(403,()->controller.list(auth(member),s));
  controller.decide(auth(admin),id,decision);
  assertEquals("SUSPENDU",status(member,s));assertEquals("ACTIF",status(member,other));
  assertEquals("ACTIF",jdbc.queryForObject("SELECT statut FROM utilisateur WHERE id=?",String.class,member));
  assertEquals(admin,jdbc.queryForObject("SELECT decideur_id FROM demande_intervention_membre WHERE id=?",Long.class,id));
  denied(409,()->controller.decide(auth(admin),id,decision));
 }
 @Test void refusalDoesNotSuspendAndNewAdministratorCannotBeSuspendedViaMemberRequest(){
  long owner=user(),admin=user(),member=user(),s=space(owner);
  jdbc.update("INSERT INTO role_plateforme(utilisateur_id,role) VALUES (?,'PROPRIETAIRE')",owner);
  membership(admin,s,"ADMINISTRATEUR");membership(member,s,"MEMBRE");
  var request=new MemberInterventionController.Request(s,null,member,"Motif suffisamment détaillé");
  controller.create(auth(owner),request);
  long id=jdbc.queryForObject("SELECT id FROM demande_intervention_membre WHERE cible_id=?",Long.class,member);
  controller.decide(auth(admin),id,new MemberInterventionController.Decision(false,"Les éléments sont insuffisants"));
  assertEquals("ACTIF",status(member,s));
  controller.create(auth(owner),request);
  long next=jdbc.queryForObject("SELECT max(id) FROM demande_intervention_membre WHERE cible_id=?",Long.class,member);
  jdbc.update("UPDATE appartenance_espace SET role='ADMINISTRATEUR' WHERE utilisateur_id=? AND espace_id=?",member,s);
  denied(409,()->controller.decide(auth(admin),next,new MemberInterventionController.Decision(true,"Décision après changement de rôle")));
  assertEquals("ACTIF",status(member,s));
 }
}
