package be.belconnect.backend.auth;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OwnerMfaService {
    static final String VERIFIED_AT="owner.mfa.verifiedAt";
    static final String VERIFIED="owner.mfa.version";
    static final String PENDING="owner.mfa.pending";
    static final String PENDING_AT="owner.mfa.pendingAt";
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final String encryptionKey;
    private final SecureRandom random=new SecureRandom();
    public OwnerMfaService(JdbcTemplate jdbc,TransactionTemplate tx,@Value("${OWNER_MFA_ENCRYPTION_KEY:}") String encryptionKey) {
        this.jdbc=jdbc;this.tx=tx;this.encryptionKey=encryptionKey;
    }
    Long ownerId(String email) {
        return jdbc.query("SELECT u.id FROM utilisateur u JOIN role_plateforme r ON r.utilisateur_id=u.id WHERE u.email=? AND u.statut='ACTIF' AND r.role='PROPRIETAIRE'",(r,n)->r.getLong(1),email).stream().findFirst().orElse(null);
    }
    public record Status(boolean owner,boolean enabled,boolean verified) {}
    Status status(long id,HttpSession session) {
        var rows=jdbc.queryForList("SELECT active,version FROM owner_second_factor WHERE utilisateur_id=?",id);
        boolean enabled=!rows.isEmpty() && Boolean.TRUE.equals(rows.getFirst().get("active"));
        boolean verified=enabled && session!=null && Objects.equals(rows.getFirst().get("version"),session.getAttribute(VERIFIED));
        return new Status(true,enabled,verified);
    }
    boolean recentlyVerified(long id,HttpSession session){
        Object at=session==null?null:session.getAttribute(VERIFIED_AT);
        return status(id,session).verified() && at instanceof Long time && System.currentTimeMillis()-time<300_000;
    }
    void checkPassword(long id,String password) {
        Long result=tx.execute(transaction->{
            ensureRow(id);var row=locked(id);if(blocked(row))return -3L;
            String stored=jdbc.queryForObject("SELECT mot_de_passe_hash FROM utilisateur WHERE id=? AND statut='ACTIF'",String.class,id);
            if(!new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().matches(password,stored)){failure(id,row);return -1L;}
            return 0L;
        });check(result);
    }
    public record Event(long id,String action,java.time.OffsetDateTime at) {}
    public record Events(List<Event> items,boolean hasMore) {}
    Events events(long id,HttpSession session,Long before) {
        if(!status(id,session).verified()) throw error(403,"Validez votre double authentification pour consulter le journal.");
        if(before!=null && before<1) throw error(400,"Page invalide.");
        List<Event> rows=before==null
            ? jdbc.query("SELECT id,evenement,date_creation FROM owner_security_event WHERE utilisateur_id=? ORDER BY id DESC LIMIT 26",(r,n)->new Event(r.getLong(1),r.getString(2),r.getObject(3,java.time.OffsetDateTime.class)),id)
            : jdbc.query("SELECT id,evenement,date_creation FROM owner_security_event WHERE utilisateur_id=? AND id<? ORDER BY id DESC LIMIT 26",(r,n)->new Event(r.getLong(1),r.getString(2),r.getObject(3,java.time.OffsetDateTime.class)),id,before);
        return new Events(rows.stream().limit(25).toList(),rows.size()>25);
    }
    public record Action(String key,String action,String target,String reason,java.time.OffsetDateTime at) {}
    public record Actions(List<Action> items,boolean hasMore) {}
    Actions actions(long id,HttpSession session,int page) {
        if(!status(id,session).verified()) throw error(403,"Validez votre double authentification pour consulter les actions.");
        if(page<0 || page>10000) throw error(400,"Page invalide.");
        var rows=jdbc.query("""
            SELECT * FROM (
              SELECT 'moderation-'||m.id AS key,m.action AS action,
                e.nom||COALESCE(' — '||a.titre,' — '||p.titre,'') AS target,m.motif AS reason,m.date_action AS at
              FROM moderation_plateforme m JOIN espace_organisateur e ON e.id=m.espace_id
                LEFT JOIN activite a ON a.id=m.activite_id LEFT JOIN projet p ON p.id=m.projet_id
              WHERE m.acteur_id=?
              UNION ALL
              SELECT 'gestion-'||h.id,h.action,e.nom||COALESCE(' — '||u.prenom||' '||u.nom,''),h.motif,h.date_action
              FROM historique_gestion_espace h JOIN espace_organisateur e ON e.id=h.espace_id
                LEFT JOIN utilisateur u ON u.id=h.cible_utilisateur_id
              WHERE h.acteur_id=? AND h.action NOT IN ('OUVERTURE_APPROUVEE','ESPACE_CORRIGE')
              UNION ALL
              SELECT 'demande-'||d.id,'DEMANDE_'||d.statut,d.nom,d.motif,d.date_decision
              FROM demande_espace d WHERE d.examinateur_id=? AND d.date_decision IS NOT NULL
              UNION ALL
              SELECT 'revision-'||h.id,'DEMANDE_'||h.action,d.nom,h.motif,h.date_action
              FROM historique_revision_demande_espace h JOIN demande_espace d ON d.id=h.demande_id WHERE h.acteur_id=?
              UNION ALL
              SELECT 'signalement-'||s.id,'SIGNALEMENT_EXAMINE','Signalement de message', '',s.date_traitement
              FROM signalement_message_prive s WHERE s.traitant_id=? AND s.date_traitement IS NOT NULL
            ) logs ORDER BY at DESC,key DESC LIMIT 26 OFFSET ?
            """,(r,n)->new Action(r.getString("key"),r.getString("action"),r.getString("target"),r.getString("reason"),r.getObject("at",java.time.OffsetDateTime.class)),id,id,id,id,id,page*25);
        return new Actions(rows.stream().limit(25).toList(),rows.size()>25);
    }
    String begin(long id,HttpSession session) {
        key(); // Fail closed when the deployment has no encryption key.
        if(status(id,session).enabled() && !status(id,session).verified()) throw error(403,"Validez d’abord votre second facteur.");
        byte[] secret=new byte[20];random.nextBytes(secret);
        session.setAttribute(PENDING,secret); session.setAttribute(PENDING_AT,System.currentTimeMillis());
        return base32(secret);
    }
    List<String> confirm(long id,HttpSession session,String code) {
        byte[] secret=(byte[])session.getAttribute(PENDING);
        Long since=(Long)session.getAttribute(PENDING_AT);
        if(secret==null || since==null || System.currentTimeMillis()-since>600_000) throw error(409,"La configuration a expiré. Recommencez.");
        var codes=new ArrayList<String>();
        for(int i=0;i<10;i++) {byte[] b=new byte[16];random.nextBytes(b);codes.add(HexFormat.of().formatHex(b));}
        Long version=tx.execute(transaction->{
            ensureRow(id);
            var row=locked(id);
            if(Boolean.TRUE.equals(row.get("active")) && !Objects.equals(row.get("version"),session.getAttribute(VERIFIED))) return -2L;
            if(blocked(row)) return -3L;
            long step=matchingStep(secret,code,-1);
            if(step<0){failure(id,row);return -1L;}
            jdbc.update("UPDATE owner_second_factor SET secret_chiffre=?,active=true,dernier_pas=?,echecs=0,bloque_jusqua=NULL,version=version+1 WHERE utilisateur_id=?",encrypt(secret,id),step,id);
            jdbc.update("DELETE FROM owner_recovery_code WHERE utilisateur_id=?",id);
            for(String value:codes) jdbc.update("INSERT INTO owner_recovery_code VALUES (?,?)",id,hash(value));
            event(id,"ACTIVATION");
            return ((Number)row.get("version")).longValue()+1;
        });
        check(version);
        session.removeAttribute(PENDING);session.removeAttribute(PENDING_AT);session.setAttribute(VERIFIED,version);session.setAttribute(VERIFIED_AT,System.currentTimeMillis());
        return codes;
    }
    void verify(long id,HttpSession session,String code,boolean recovery) {
        Long version=tx.execute(transaction->{
            ensureRow(id);var row=locked(id);
            if(!Boolean.TRUE.equals(row.get("active"))) return -2L;
            if(blocked(row)) return -3L;
            boolean valid;
            if(recovery) valid=jdbc.update("DELETE FROM owner_recovery_code WHERE utilisateur_id=? AND empreinte=?",id,hash(code.strip().toLowerCase(Locale.ROOT)))==1;
            else {
                long step=matchingStep(decrypt((String)row.get("secret_chiffre"),id),code,((Number)row.get("dernier_pas")).longValue());
                valid=step>=0;
                if(valid) jdbc.update("UPDATE owner_second_factor SET dernier_pas=? WHERE utilisateur_id=?",step,id);
            }
            if(!valid){failure(id,row);return -1L;}
            // Recovery invalidates all previously verified sessions.
            jdbc.update("UPDATE owner_second_factor SET echecs=0,bloque_jusqua=NULL,version=version+? WHERE utilisateur_id=?",recovery?1:0,id);
            event(id,recovery?"RECUPERATION":"VERIFICATION");
            return ((Number)row.get("version")).longValue()+(recovery?1:0);
        });
        check(version);session.setAttribute(VERIFIED,version);session.setAttribute(VERIFIED_AT,System.currentTimeMillis());
    }
    private void ensureRow(long id){jdbc.update("INSERT INTO owner_second_factor(utilisateur_id) VALUES (?) ON CONFLICT DO NOTHING",id);}
    private Map<String,Object> locked(long id){return jdbc.queryForMap("SELECT *,bloque_jusqua>now() AS blocked FROM owner_second_factor WHERE utilisateur_id=? FOR UPDATE",id);}
    private boolean blocked(Map<String,Object> row){return Boolean.TRUE.equals(row.get("blocked"));}
    private void failure(long id,Map<String,Object> row){
        int count=((Number)row.get("echecs")).intValue()+1;
        int seconds=count<5?0:Math.min(900,30*(1<<Math.min(5,count-5)));
        jdbc.update("UPDATE owner_second_factor SET echecs=?,bloque_jusqua=now()+(? * interval '1 second') WHERE utilisateur_id=?",count,seconds,id);
        event(id,"ECHEC");
    }
    private void event(long id,String event){jdbc.update("INSERT INTO owner_security_event(utilisateur_id,evenement) VALUES (?,?)",id,event);}
    private void check(Long result){if(result==null||result==-2)throw error(409,"La configuration a changé. Reconnectez-vous.");if(result==-3)throw error(429,"Trop de tentatives. Patientez avant de réessayer (quinze minutes au maximum).");if(result<0)throw error(400,"Code invalide ou déjà utilisé. Vérifiez l’heure du téléphone et essayez le code suivant.");}
    static long matchingStep(byte[] secret,String code,long last){
        if(code==null||!code.matches("[0-9]{6}"))return -1;
        long now=Instant.now().getEpochSecond()/30;
        for(long step=now-1;step<=now+1;step++)if(step>last&&MessageDigest.isEqual(totp(secret,step).getBytes(StandardCharsets.US_ASCII),code.getBytes(StandardCharsets.US_ASCII)))return step;
        return -1;
    }
    static String totp(byte[] secret,long step){
        try{Mac mac=Mac.getInstance("HmacSHA1");mac.init(new SecretKeySpec(secret,"HmacSHA1"));byte[] value=mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());int offset=value[value.length-1]&15;int number=ByteBuffer.wrap(value,offset,4).getInt()&0x7fffffff;return String.format(Locale.ROOT,"%06d",number%1_000_000);}catch(GeneralSecurityException e){throw new IllegalStateException(e);}
    }
    static String base32(byte[] bytes){String alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";StringBuilder result=new StringBuilder();int value=0,bits=0;for(byte b:bytes){value=(value<<8)|(b&255);bits+=8;while(bits>=5){bits-=5;result.append(alphabet.charAt((value>>bits)&31));}}if(bits>0)result.append(alphabet.charAt((value<<(5-bits))&31));return result.toString();}
    private byte[] key(){try{byte[] key=Base64.getDecoder().decode(encryptionKey);if(key.length==32)return key;}catch(IllegalArgumentException ignored){}throw error(503,"La protection propriétaire doit être configurée sur le serveur.");}
    private String encrypt(byte[] secret,long id){try{byte[] nonce=new byte[12];random.nextBytes(nonce);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key(),"AES"),new GCMParameterSpec(128,nonce));cipher.updateAAD(Long.toString(id).getBytes(StandardCharsets.US_ASCII));byte[] encrypted=cipher.doFinal(secret);return Base64.getEncoder().encodeToString(ByteBuffer.allocate(nonce.length+encrypted.length).put(nonce).put(encrypted).array());}catch(GeneralSecurityException e){throw new IllegalStateException(e);}}
    private byte[] decrypt(String value,long id){try{byte[] bytes=Base64.getDecoder().decode(value);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key(),"AES"),new GCMParameterSpec(128,Arrays.copyOfRange(bytes,0,12)));cipher.updateAAD(Long.toString(id).getBytes(StandardCharsets.US_ASCII));return cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length));}catch(GeneralSecurityException e){throw error(503,"La protection propriétaire est momentanément indisponible.");}}
    static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(GeneralSecurityException e){throw new IllegalStateException(e);}}
    private static ResponseStatusException error(int status,String message){return new ResponseStatusException(HttpStatus.valueOf(status),message);}
}
