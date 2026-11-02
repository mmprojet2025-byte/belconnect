package be.belconnect.backend.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Shared web/mobile limits. Rejected attempts commit before an HTTP error is raised. */
@Service
public class LoginProtection {
 private final JdbcTemplate jdbc;
 private final TransactionTemplate tx;
 private final AccountRepository accounts;
 private final PasswordEncoder passwords;
 private final String dummy;
 public LoginProtection(JdbcTemplate jdbc,TransactionTemplate tx,AccountRepository accounts,PasswordEncoder passwords){this.jdbc=jdbc;this.tx=tx;this.accounts=accounts;this.passwords=passwords;dummy=passwords.encode(java.util.UUID.randomUUID().toString());}
 private record Outcome(AccountRepository.Account account,int retry){}
 public AccountRepository.Account authenticate(String email,String address,String password){
  String accountKey="account:"+OwnerMfaService.hash(email);
  String ipKey="ip:"+OwnerMfaService.hash(address);
  Outcome outcome=tx.execute(status->{
   // Expired identifiers are removed opportunistically. No clear-text address is stored.
   jdbc.update("DELETE FROM login_attempt_limit WHERE derniere_activite<now()-interval '24 hours'");
   ensure(ipKey);var ip=jdbc.queryForMap("SELECT *,debut_fenetre<=now()-interval '1 minute' AS expired FROM login_attempt_limit WHERE cle=? FOR UPDATE",ipKey);
   if(Boolean.TRUE.equals(ip.get("expired")))jdbc.update("UPDATE login_attempt_limit SET echecs=0,debut_fenetre=now() WHERE cle=?",ipKey);
   int count=Boolean.TRUE.equals(ip.get("expired"))?0:((Number)ip.get("echecs")).intValue();
   if(count>=20){int wait=jdbc.queryForObject("SELECT GREATEST(1,ceil(extract(epoch FROM debut_fenetre+interval '1 minute'-now())))::int FROM login_attempt_limit WHERE cle=?",Integer.class,ipKey);return new Outcome(null,wait);}
   jdbc.update("UPDATE login_attempt_limit SET echecs=echecs+1,derniere_activite=now() WHERE cle=?",ipKey);
   ensure(accountKey);
   var row=jdbc.queryForMap("SELECT *,GREATEST(0,ceil(extract(epoch FROM bloque_jusqua-now())))::int AS attente FROM login_attempt_limit WHERE cle=? FOR UPDATE",accountKey);
   int wait=((Number)row.get("attente")).intValue();
   if(wait>0)return new Outcome(null,wait); // Blocked requests never extend the account delay.
   var account=accounts.findByEmail(email).orElse(null);
   boolean matches=passwords.matches(password,account==null?dummy:account.passwordHash());
   if(matches && account!=null && "ACTIF".equals(account.status())){
    jdbc.update("UPDATE login_attempt_limit SET echecs=0,bloque_jusqua=NULL,derniere_activite=now() WHERE cle=?",accountKey);
    return new Outcome(account,0);
   }
   int failures=Math.min(35,((Number)row.get("echecs")).intValue()+1);
   int delay=failures<5?0:Math.min(900,30*(1<<Math.min(5,failures-5)));
   jdbc.update("UPDATE login_attempt_limit SET echecs=?,bloque_jusqua=now()+(?*interval '1 second'),derniere_activite=now() WHERE cle=?",failures,delay,accountKey);
   return new Outcome(null,0);
  });
  if(outcome.retry()>0)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Trop de tentatives. Réessayez dans "+outcome.retry()+" secondes."){
   @Override public HttpHeaders getHeaders(){var headers=new HttpHeaders();headers.set("Retry-After",Integer.toString(outcome.retry()));return headers;}
  };
  if(outcome.account()==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Adresse e-mail ou mot de passe incorrect.");
  return outcome.account();
 }
 private void ensure(String key){jdbc.update("INSERT INTO login_attempt_limit(cle) VALUES (?) ON CONFLICT DO NOTHING",key);}
}
