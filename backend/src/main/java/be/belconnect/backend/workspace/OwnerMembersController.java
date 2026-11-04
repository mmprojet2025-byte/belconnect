package be.belconnect.backend.workspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace")
public class OwnerMembersController {
  private final JdbcTemplate jdbc;
  public OwnerMembersController(JdbcTemplate jdbc) { this.jdbc=jdbc; }

  public record Assignment(String scope,String name,String role,String status,Long scopeId,Long spaceId) { public Assignment(String scope,String name,String role,String status){this(scope,name,role,status,null,null);} }
  public record Member(long id,String name,String email,String status,boolean owner,List<Assignment> roles) {}
  public record MemberPage(List<Member> items,long total,int page,int pageSize) {}

  @GetMapping("/owner/members/paged")
  public ResponseEntity<MemberPage> pagedMembers(Authentication auth,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="") String role,@RequestParam(defaultValue="") String status,@RequestParam(required=false) Long spaceId,@RequestParam(required=false) Long groupId) {
    if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous connecter.");
    Boolean owner=jdbc.queryForObject("""
        SELECT EXISTS(SELECT 1 FROM role_plateforme r JOIN utilisateur u ON u.id=r.utilisateur_id
          WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE')
        """,Boolean.class,auth.getName());
    if(!Boolean.TRUE.equals(owner)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Accès réservé au propriétaire.");
    if(page<0 || page>100000 || search.length()>100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Recherche ou page invalide.");
    String needle="%"+search.strip().toLowerCase().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
    String where="""
        WHERE u.email<>'belconnect-demo-projects@example.invalid' AND (
          lower(concat_ws(' ',u.prenom,u.nom)) LIKE ? ESCAPE '\\' OR lower(u.email) LIKE ? ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM appartenance_espace ae JOIN espace_organisateur e ON e.id=ae.espace_id
            WHERE ae.utilisateur_id=u.id AND lower(e.nom) LIKE ? ESCAPE '\\')
          OR EXISTS (SELECT 1 FROM appartenance_groupe ag JOIN groupe g ON g.id=ag.groupe_id
            WHERE ag.utilisateur_id=u.id AND lower(g.nom) LIKE ? ESCAPE '\\'))
        """;
    var args=new ArrayList<Object>(List.of(needle,needle,needle,needle));
    if(!status.isEmpty()){if(!List.of("ACTIF","SUSPENDU","DESACTIVE").contains(status))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);where+=" AND u.statut=?";args.add(status);}
    if(!role.isEmpty()){
      if(role.equals("PROPRIETAIRE"))where+=" AND EXISTS(SELECT 1 FROM role_plateforme r WHERE r.utilisateur_id=u.id AND r.role='PROPRIETAIRE')";
      else if(List.of("ADMINISTRATEUR","REFERENT","MEMBRE").contains(role)){
        String table=role.equals("REFERENT")?"appartenance_groupe":"appartenance_espace";
        where+=" AND EXISTS(SELECT 1 FROM "+table+" a WHERE a.utilisateur_id=u.id AND a.role=? AND a.statut='ACTIF'";args.add(role);
        if(spaceId!=null){where+=" AND a.espace_id=?";args.add(spaceId);}
        if(groupId!=null&&role.equals("REFERENT")){where+=" AND a.groupe_id=?";args.add(groupId);}
        where+=")";
      }else throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    }
    if(spaceId!=null){where+=" AND EXISTS(SELECT 1 FROM appartenance_espace a WHERE a.utilisateur_id=u.id AND a.espace_id=? AND a.statut<>'RETIRE')";args.add(spaceId);}
    if(groupId!=null){where+=" AND EXISTS(SELECT 1 FROM appartenance_groupe a WHERE a.utilisateur_id=u.id AND a.groupe_id=? AND a.statut<>'RETIRE')";args.add(groupId);}
    Long total=jdbc.queryForObject("SELECT count(*) FROM utilisateur u "+where,Long.class,args.toArray());
    args.add(page*20);
    var people=new LinkedHashMap<Long,Member>();
    jdbc.query("""
        SELECT u.id,u.prenom,u.nom,u.email,u.statut,EXISTS(SELECT 1 FROM role_plateforme r
          WHERE r.utilisateur_id=u.id AND r.role='PROPRIETAIRE') AS owner
        FROM utilisateur u
        """+where+" ORDER BY lower(u.nom),lower(u.prenom),u.id LIMIT 20 OFFSET ?",row->{
          String name=((row.getString("prenom")==null?"":row.getString("prenom"))+" "+row.getString("nom")).trim();
          var member=new Member(row.getLong("id"),name,row.getString("email"),row.getString("statut"),row.getBoolean("owner"),new ArrayList<>());
          people.put(member.id(),member);
        },args.toArray());
    for(var member:people.values()) {
      jdbc.query("""
          SELECT e.id,e.nom,a.role,a.statut FROM appartenance_espace a JOIN espace_organisateur e ON e.id=a.espace_id
          WHERE a.utilisateur_id=? ORDER BY e.nom
          """,row->{ member.roles().add(new Assignment("ESPACE",row.getString("nom"),row.getString("role"),row.getString("statut"),row.getLong("id"),row.getLong("id"))); },member.id());
      jdbc.query("""
          SELECT g.id,g.espace_id,g.nom,a.role,a.statut FROM appartenance_groupe a JOIN groupe g ON g.id=a.groupe_id
          WHERE a.utilisateur_id=? ORDER BY g.nom
          """,row->{ member.roles().add(new Assignment("GROUPE",row.getString("nom"),row.getString("role"),row.getString("statut"),row.getLong("id"),row.getLong("espace_id"))); },member.id());
    }
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new MemberPage(List.copyOf(people.values()),total==null?0:total,page,20));
  }

  @GetMapping("/spaces/{spaceId}/members")
  public ResponseEntity<List<Member>> spaceMembers(Authentication auth,@PathVariable long spaceId) {
    if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous connecter.");
    Boolean admin=jdbc.queryForObject("""
        SELECT EXISTS(SELECT 1 FROM appartenance_espace a JOIN utilisateur u ON u.id=a.utilisateur_id
          JOIN espace_organisateur e ON e.id=a.espace_id
          WHERE a.espace_id=? AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF'
            AND u.email=? AND u.statut='ACTIF' AND e.statut='ACTIF')
        """,Boolean.class,spaceId,auth.getName());
    if(!Boolean.TRUE.equals(admin)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Accès réservé aux administrateurs de cet espace.");
    var people=new LinkedHashMap<Long,Member>();
    jdbc.query("""
        SELECT u.id,u.prenom,u.nom,u.email,u.statut,a.role,a.statut AS role_statut,e.nom AS espace_nom
        FROM appartenance_espace a JOIN utilisateur u ON u.id=a.utilisateur_id
        JOIN espace_organisateur e ON e.id=a.espace_id
        WHERE a.espace_id=? AND a.statut<>'RETIRE'
        ORDER BY lower(u.nom),lower(u.prenom),u.id
        """,row->{
          String name=((row.getString("prenom")==null?"":row.getString("prenom"))+" "+row.getString("nom")).trim();
          var roles=new ArrayList<Assignment>();
          roles.add(new Assignment("ESPACE",row.getString("espace_nom"),row.getString("role"),row.getString("role_statut")));
          var member=new Member(row.getLong("id"),name,row.getString("email"),row.getString("statut"),false,roles);
          people.put(member.id(),member);
        },spaceId);
    jdbc.query("""
        SELECT a.utilisateur_id,g.nom,a.role,a.statut FROM appartenance_groupe a
        JOIN groupe g ON g.id=a.groupe_id WHERE a.espace_id=? AND a.statut<>'RETIRE' ORDER BY g.nom
        """,row->{
          var member=people.get(row.getLong("utilisateur_id"));
          if(member!=null) member.roles().add(new Assignment("GROUPE",row.getString("nom"),row.getString("role"),row.getString("statut")));
        },spaceId);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(List.copyOf(people.values()));
  }

  @GetMapping("/owner/members")
  public ResponseEntity<List<Member>> members(Authentication auth) {
    if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Veuillez vous connecter.");
    Boolean owner=jdbc.queryForObject("""
        SELECT EXISTS(SELECT 1 FROM role_plateforme r JOIN utilisateur u ON u.id=r.utilisateur_id
          WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE')
        """,Boolean.class,auth.getName());
    if(!Boolean.TRUE.equals(owner)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Accès réservé au propriétaire.");
    var people=new LinkedHashMap<Long,Member>();
    jdbc.query("""
        SELECT u.id,u.prenom,u.nom,u.email,u.statut,(r.role='PROPRIETAIRE') AS owner
        FROM utilisateur u LEFT JOIN role_plateforme r ON r.utilisateur_id=u.id
        WHERE u.email<>'belconnect-demo-projects@example.invalid'
        ORDER BY lower(u.nom),lower(u.prenom),u.id
        """,row->{
          String name=((row.getString("prenom")==null?"":row.getString("prenom"))+" "+row.getString("nom")).trim();
          var member=new Member(row.getLong("id"),name,row.getString("email"),row.getString("statut"),
              row.getBoolean("owner"),new ArrayList<>());
          people.put(member.id(),member);
        });
    jdbc.query("""
        SELECT a.utilisateur_id,e.nom,a.role,a.statut FROM appartenance_espace a
        JOIN espace_organisateur e ON e.id=a.espace_id ORDER BY e.nom
        """,row->{
          var member=people.get(row.getLong("utilisateur_id"));
          if(member!=null) member.roles().add(new Assignment("ESPACE",row.getString("nom"),row.getString("role"),row.getString("statut")));
        });
    jdbc.query("""
        SELECT a.utilisateur_id,g.nom,a.role,a.statut FROM appartenance_groupe a
        JOIN groupe g ON g.id=a.groupe_id ORDER BY g.nom
        """,row->{
          var member=people.get(row.getLong("utilisateur_id"));
          if(member!=null) member.roles().add(new Assignment("GROUPE",row.getString("nom"),row.getString("role"),row.getString("statut")));
        });
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(List.copyOf(people.values()));
  }
}
