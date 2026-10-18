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
        return jdbc.query("SELECT * FROM activite WHERE publiee ORDER BY debut, id", this::map);
    }

    public Optional<ActivityView> findPublishedBySlug(String slug) {
        return jdbc.query("SELECT * FROM activite WHERE publiee AND slug = ?", this::map, slug)
                .stream().findFirst();
    }

    private ActivityView map(ResultSet row, int index) throws SQLException {
        return new ActivityView(row.getString("slug"), row.getString("titre"), row.getString("categorie"),
                row.getString("ville"), row.getString("lieu"), row.getString("organisateur_nom"),
                row.getBigDecimal("prix"), row.getString("image"), row.getObject("debut", OffsetDateTime.class).atZoneSameInstant(ZoneId.of("Europe/Brussels")).toOffsetDateTime(),
                row.getString("description"), row.getString("badge"), row.getBoolean("demonstration"),
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
