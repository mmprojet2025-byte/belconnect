package be.belconnect.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class OwnerSessionService {
 static final String TAG="owner.session.tag";
 private final JdbcTemplate jdbc;
 private final TransactionTemplate tx;
 public OwnerSessionService(JdbcTemplate jdbc,TransactionTemplate tx){this.jdbc=jdbc;this.tx=tx;}
 private String fingerprint(HttpSession session){Object value=session==null?null:session.getAttribute(TAG);return value==null?null:OwnerMfaService.hash(value.toString());}
 boolean touch(long user,HttpServletRequest request){
  var session=request.getSession(false);if(session==null)return false;
  String hash;
  synchronized(session){
   if(session.getAttribute(TAG)==null){
    String tag=UUID.randomUUID().toString()+UUID.randomUUID();
    String agent=request.getHeader("User-Agent");agent=agent==null?"":agent;
    String browser=agent.contains("Edg/")?"Edge":agent.contains("Firefox/")?"Firefox":agent.contains("Chrome/")?"Chrome":agent.contains("Safari/")?"Safari":"Navigateur non identifié";
    String device=agent.contains("Android")?"Android":agent.contains("iPhone")||agent.contains("iPad")?"iPhone / iPad":agent.contains("Windows")?"Windows":agent.contains("Macintosh")?"Mac":agent.contains("Linux")?"Linux":"Appareil non identifié";
    jdbc.update("INSERT INTO owner_web_session(utilisateur_id,empreinte,navigateur,appareil) VALUES (?,?,?,?)",user,OwnerMfaService.hash(tag),browser,device);
    session.setAttribute(TAG,tag);
   }
   hash=fingerprint(session);
  }
  return jdbc.update("UPDATE owner_web_session SET vu_le=now() WHERE utilisateur_id=? AND empreinte=? AND revoquee_le IS NULL",user,hash)==1;
 }
 public record Session(long id,String browser,String device,OffsetDateTime createdAt,OffsetDateTime lastSeen,boolean current){}
 List<Session> list(long user,HttpSession session){String current=fingerprint(session);
  return jdbc.query("SELECT * FROM owner_web_session WHERE utilisateur_id=? AND revoquee_le IS NULL AND vu_le>now()-interval '15 minutes' ORDER BY (empreinte=?) DESC,vu_le DESC",(r,n)->new Session(r.getLong("id"),r.getString("navigateur"),r.getString("appareil"),r.getObject("cree_le",OffsetDateTime.class),r.getObject("vu_le",OffsetDateTime.class),r.getString("empreinte").equals(current)),user,current);
 }
 int revoke(long user,HttpSession current,Long target){String hash=fingerprint(current);if(hash==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
  return tx.execute(status->{
   int count=target==null?jdbc.update("UPDATE owner_web_session SET revoquee_le=now() WHERE utilisateur_id=? AND empreinte<>? AND revoquee_le IS NULL",user,hash):jdbc.update("UPDATE owner_web_session SET revoquee_le=now() WHERE utilisateur_id=? AND id=? AND empreinte<>? AND revoquee_le IS NULL",user,target,hash);
   if(count>0)jdbc.update("INSERT INTO owner_security_event(utilisateur_id,evenement) VALUES (?,?)",user,target==null?"AUTRES_SESSIONS_REVOQUEES":"SESSION_REVOQUEE");
   return count;
  });
 }
 void close(HttpSession session){String hash=fingerprint(session);if(hash!=null)jdbc.update("UPDATE owner_web_session SET revoquee_le=now() WHERE empreinte=? AND revoquee_le IS NULL",hash);}
}
