package be.belconnect.backend;
import java.net.*;
import java.net.http.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class NotificationHideApiTests {
 @LocalServerPort int port; @Autowired JdbcTemplate jdbc;
 final HttpClient client=HttpClient.newHttpClient(); final ObjectMapper json=new ObjectMapper();
 record Account(long id,String token){}
 HttpResponse<String> call(String method,String path,String token,String body)throws Exception{
  var request=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Accept","application/json");
  if(token!=null)request.header("Authorization","Bearer "+token);
  if(body!=null)request.header("Content-Type","application/json");
  request.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body));
  return client.send(request.build(),HttpResponse.BodyHandlers.ofString());
 }
 Account register(String marker)throws Exception{
  var response=call("POST","/api/mobile/auth/register",null,"{\"email\":\""+marker+"@example.com\",\"password\":\"Notification-test-123\",\"firstName\":\"Nora\",\"lastName\":\"Mobile\"}");
  assertEquals(201,response.statusCode(),response.body());var data=json.readTree(response.body());
  return new Account(data.get("profile").get("id").asLong(),data.get("token").asText());
 }
 @Test void onlyOwnerCanHideReadNotificationWithoutDeletingInvitation()throws Exception{
  var marker=UUID.randomUUID().toString();var admin=register("n-admin-"+marker);var member=register("n-member-"+marker);var outsider=register("n-outsider-"+marker);
  Long space=null,group=null,invite=null;
  try{
   space=jdbc.queryForObject("INSERT INTO espace_organisateur(nom,type,createur_id) VALUES (?,'ORGANISATEUR',?) RETURNING id",Long.class,"Notice "+marker,admin.id());
   group=jdbc.queryForObject("INSERT INTO groupe(espace_id,nom,visibilite) VALUES (?,?,'PRIVEE') RETURNING id",Long.class,space,"Notice "+marker);
   invite=jdbc.queryForObject("INSERT INTO invitation_groupe(groupe_id,invite_id,inviter_id) VALUES (?,?,?) RETURNING id",Long.class,group,member.id(),admin.id());
   String path="/api/mobile/notifications/group-invite/"+invite;
   assertEquals(409,call("POST",path+"/hide",member.token(),null).statusCode());
   assertEquals(404,call("POST",path+"/hide",outsider.token(),null).statusCode());
   assertEquals(204,call("POST",path+"/read",member.token(),null).statusCode());
   assertEquals(204,call("POST",path+"/hide",member.token(),null).statusCode());
   assertEquals(204,call("POST",path+"/hide",member.token(),null).statusCode());
   assertFalse(call("GET","/api/mobile/notifications",member.token(),null).body().contains("\"source\":\"group-invite\",\"id\":"+invite));
   assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM invitation_groupe WHERE id=?",Integer.class,invite));
  }finally{
   if(invite!=null){jdbc.update("DELETE FROM notification_masquee WHERE source='group-invite' AND notification_id=?",invite);jdbc.update("DELETE FROM invitation_groupe WHERE id=?",invite);}
   if(group!=null)jdbc.update("DELETE FROM groupe WHERE id=?",group);
   if(space!=null)jdbc.update("DELETE FROM espace_organisateur WHERE id=?",space);
   for(var account:new Account[]{admin,member,outsider})jdbc.update("DELETE FROM utilisateur WHERE id=?",account.id());
  }
 }
}
