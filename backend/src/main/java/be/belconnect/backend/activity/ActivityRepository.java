package be.belconnect.backend.activity;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ActivityRepository {
    private final JdbcTemplate jdbc;
    public ActivityRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<ActivityView> findPublished() {
        return findPublished(null);
    }

    public Optional<ActivityView> findPublishedBySlug(String slug) {
        return findPublishedBySlug(slug,null);
    }

    public Long userId(String email) {
        return jdbc.query("SELECT id FROM utilisateur WHERE email=? AND statut='ACTIF'",(r,n)->r.getLong(1),email).stream().findFirst().orElse(null);
    }
    public List<ActivityView> findPublished(Long user) {
        return jdbc.query("SELECT a.* FROM activite a WHERE "+ActivityAccess.VISIBLE+" ORDER BY debut,id",this::map,user);
    }
    public Optional<ActivityView> findPublishedBySlug(String slug,Long user) {
        return jdbc.query("SELECT a.* FROM activite a WHERE "+ActivityAccess.VISIBLE+" AND slug=?",this::map,user,slug).stream().findFirst();
    }

    private ActivityView map(ResultSet row, int index) throws SQLException {
        return new ActivityView(row.getString("slug"), row.getString("titre"), row.getString("categorie"),
                row.getString("ville"), row.getString("lieu"), row.getString("organisateur_nom"),
                row.getBigDecimal("prix"), row.getString("image"), row.getObject("debut", OffsetDateTime.class).atZoneSameInstant(ZoneId.of("Europe/Brussels")).toOffsetDateTime(),
                row.getString("description"), row.getString("badge"), row.getBoolean("demonstration"), row.getObject("cloture_inscriptions", OffsetDateTime.class),
                new ActivityView.Details(row.getString("duree"), row.getInt("capacite"),
                        row.getInt("places_disponibles"), row.getString("public_cible"), row.getString("rendez_vous"),
                        strings(row, "programme"), strings(row, "inclus"), row.getString("preparation")));
    }

    private List<String> strings(ResultSet row, String column) throws SQLException {
        var array = row.getArray(column);
        try { return Arrays.asList((String[]) array.getArray()); }
        finally { array.free(); }
    }
}
