package be.belconnect.backend.auth;

import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class LoginProtectionTests {
 @Autowired LoginProtection protection;
 @Autowired JdbcTemplate jdbc;
 @Autowired TransactionTemplate tx;
 @Autowired AccountRepository accounts;
 @Autowired PasswordEncoder passwords;
 String key(String scope,String value){return scope+":"+OwnerMfaService.hash(value);}
 int attempt(LoginProtection service,String email,String address,String password){try{service.authenticate(email,address,password);return 200;}catch(ResponseStatusException error){return error.getStatusCode().value();}}
 void clean(String email,String...addresses){jdbc.update("DELETE FROM login_attempt_limit WHERE cle=?",key("account",email));for(String address:addresses)jdbc.update("DELETE FROM login_attempt_limit WHERE cle=?",key("ip",address));}
 @Test void persistsAcrossServiceRestartAndResetsAfterSuccess(){
  String email="limit-"+UUID.randomUUID()+"@example.invalid",address="test-"+UUID.randomUUID(),other="test-"+UUID.randomUUID(),password="Correct-test-password-123";
  long id=accounts.create("Test","Limit",email,passwords.encode(password)).id();
  try{
   for(int i=0;i<5;i++)assertEquals(401,attempt(protection,email,address,"wrong"));
   var restarted=new LoginProtection(jdbc,tx,accounts,passwords);
   var blocked=assertThrows(ResponseStatusException.class,()->restarted.authenticate(email,other,password));assertEquals(429,blocked.getStatusCode().value());assertNotNull(blocked.getHeaders().getFirst("Retry-After"));
   var until=jdbc.queryForObject("SELECT bloque_jusqua FROM login_attempt_limit WHERE cle=?",java.time.OffsetDateTime.class,key("account",email));
   assertEquals(429,attempt(restarted,email,other,"wrong"));
   assertEquals(until,jdbc.queryForObject("SELECT bloque_jusqua FROM login_attempt_limit WHERE cle=?",java.time.OffsetDateTime.class,key("account",email)));
   jdbc.update("UPDATE login_attempt_limit SET bloque_jusqua=now()-interval '1 second' WHERE cle=?",key("account",email));
   assertEquals(200,attempt(restarted,email,other,password));assertEquals(0,jdbc.queryForObject("SELECT echecs FROM login_attempt_limit WHERE cle=?",Integer.class,key("account",email)));
   assertEquals(401,attempt(restarted,email,other,"wrong"));
  }finally{clean(email,address,other);jdbc.update("DELETE FROM utilisateur WHERE id=?",id);}
 }
 @Test void concurrentGuessesCannotPassTheAccountThreshold()throws Exception{
  String email="missing-"+UUID.randomUUID()+"@example.invalid",address="test-"+UUID.randomUUID();
  try{
   for(int i=0;i<4;i++)assertEquals(401,attempt(protection,email,address,"wrong"));
   try(var pool=Executors.newFixedThreadPool(3)){
    var results=pool.invokeAll(List.of(()->attempt(protection,email,address,"wrong"),()->attempt(protection,email,address,"wrong"),()->attempt(protection,email,address,"wrong")));
    var codes=new ArrayList<Integer>();for(var result:results)codes.add((Integer)result.get());Collections.sort(codes);assertEquals(List.of(401,429,429),codes);
   }
   assertEquals(5,jdbc.queryForObject("SELECT echecs FROM login_attempt_limit WHERE cle=?",Integer.class,key("account",email)));
  }finally{clean(email,address);}
 }
 @Test void networkWindowAndMaximumDelayAreBounded(){
  String email="missing-"+UUID.randomUUID()+"@example.invalid",address="test-"+UUID.randomUUID();
  try{
   assertEquals(401,attempt(protection,email,address,"wrong"));
   jdbc.update("UPDATE login_attempt_limit SET echecs=34,bloque_jusqua=NULL WHERE cle=?",key("account",email));
   assertEquals(401,attempt(protection,email,address,"wrong"));
   int seconds=jdbc.queryForObject("SELECT ceil(extract(epoch FROM bloque_jusqua-now()))::int FROM login_attempt_limit WHERE cle=?",Integer.class,key("account",email));assertTrue(seconds>0&&seconds<=900);
   jdbc.update("UPDATE login_attempt_limit SET echecs=20 WHERE cle=?",key("ip",address));assertEquals(429,attempt(protection,email,address,"wrong"));
   jdbc.update("UPDATE login_attempt_limit SET derniere_activite=now()-interval '25 hours' WHERE cle IN (?,?)",key("ip",address),key("account",email));assertEquals(401,attempt(protection,email,address,"wrong"));
  }finally{clean(email,address);}
 }
}
