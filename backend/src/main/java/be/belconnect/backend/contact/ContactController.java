package be.belconnect.backend.contact;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/contact")
public class ContactController {
  private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
  private final JdbcTemplate jdbc;
  private final ClientAddressResolver addresses;
  public ContactController(JdbcTemplate jdbc,ClientAddressResolver addresses) { this.jdbc = jdbc;this.addresses=addresses; }
  public record ContactRequest(String name, String email, String category, String message, boolean replyRequested, boolean consent, String website) {}
  public record Receipt(long id, OffsetDateTime receivedAt) {}

  @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
  public Receipt create(@RequestBody ContactRequest body, Authentication auth, HttpServletRequest request) {
    if (body == null) bad("Vérifiez les informations saisies.");
    String name = clean(body.name(), 120), email = clean(body.email(), 254).toLowerCase(Locale.ROOT);
    String message = body.message() == null ? "" : body.message().trim();
    String category = body.category() == null ? "" : body.category().trim().toUpperCase(Locale.ROOT);
    if (!clean(body.website(), 200).isEmpty()) bad("Votre message n’a pas pu être envoyé.");
    if (!body.consent()) bad("Votre consentement est nécessaire pour envoyer ce message.");
    if (!java.util.Set.of("AVIS", "SUGGESTION", "PROBLEME", "QUESTION").contains(category)) bad("Choisissez une catégorie valide.");
    if (message.length() < 10 || message.length() > 4000) bad("Le message doit contenir entre 10 et 4 000 caractères.");
    if (!email.isEmpty() && !EMAIL.matcher(email).matches()) bad("Saisissez une adresse e-mail valide.");
    if (body.replyRequested() && email.isEmpty()) bad("Une adresse e-mail est nécessaire si vous souhaitez une réponse.");
    applyRateLimit(addresses.resolve(request));
    Long account = auth == null ? null : jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'", (r,n)->r.getLong(1), auth.getName()).stream().findFirst().orElse(null);
    return jdbc.queryForObject("""
      INSERT INTO message_contact(utilisateur_id,nom,email,categorie,message,reponse_souhaitee,consentement)
      VALUES (?,?,?,?,?,?,?) RETURNING id,date_creation
      """, (r,n)->new Receipt(r.getLong(1),r.getObject(2,OffsetDateTime.class)), account, emptyToNull(name), emptyToNull(email), category, message, body.replyRequested(), true);
  }
  private void applyRateLimit(String address) {
    String key = "ip:" + hash(address == null ? "unknown" : address);
    jdbc.update("DELETE FROM limite_message_contact WHERE derniere_activite<now()-interval '24 hours'");
    jdbc.update("INSERT INTO limite_message_contact(cle) VALUES (?) ON CONFLICT DO NOTHING", key);
    var row = jdbc.queryForMap("SELECT *,debut_fenetre<=now()-interval '1 hour' AS expired FROM limite_message_contact WHERE cle=? FOR UPDATE", key);
    boolean expired = Boolean.TRUE.equals(row.get("expired"));
    int count = expired ? 0 : ((Number)row.get("nombre")).intValue();
    if (count >= 5) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Trop de messages ont été envoyés. Réessayez plus tard.");
    jdbc.update("UPDATE limite_message_contact SET nombre=?,debut_fenetre=CASE WHEN ? THEN now() ELSE debut_fenetre END,derniere_activite=now() WHERE cle=?", count+1, expired, key);
  }
  private static String clean(String value, int max) { String v=value==null?"":value.trim(); return v.length()>max?v.substring(0,max):v; }
  private static String emptyToNull(String value) { return value.isEmpty()?null:value; }
  private static void bad(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
  private static String hash(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception e) { throw new IllegalStateException(e); } }
}
