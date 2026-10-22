package be.belconnect.backend;

import be.belconnect.backend.activity.ActivityRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ActivityApiTests {
    @LocalServerPort int port;
    @Autowired ActivityRepository repository;
    @Autowired JdbcTemplate jdbc;

    @Test void publicApiReturnsSeededActivitiesAnd404() throws Exception {
        var client = HttpClient.newHttpClient();
        var list = client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/activities")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, list.statusCode());
        assertTrue(list.body().contains("\"id\":\"chocolat\""));
        assertTrue(list.body().contains("\"details\""));
        assertTrue(list.headers().firstValue("Cache-Control").orElse("").contains("no-store"));
        var detail = client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/activities/chocolat")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, detail.statusCode());
        assertTrue(detail.body().contains("\"price\":45"));
        var missing = client.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/activities/inconnue")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(404, missing.statusCode());
    }

    @Test @Transactional void databaseChangesAreReadAndUnpublishedActivitiesAreHidden() {
        jdbc.update("UPDATE activite SET titre = ?, prix = ? WHERE slug = ?", "Atelier modifié en base", 47.50, "chocolat");
        var item = repository.findPublishedBySlug("chocolat").orElseThrow();
        assertEquals("Atelier modifié en base", item.title());
        assertEquals("47.50", item.price().toPlainString());
        jdbc.update("UPDATE activite SET publiee = false WHERE slug = 'chocolat'");
        assertTrue(repository.findPublishedBySlug("chocolat").isEmpty());
        assertTrue(repository.findPublished().stream().noneMatch(a -> a.id().equals("chocolat")));
        assertTrue(repository.findPublishedBySlug("' OR 1=1 --").isEmpty());
    }

    @Test @Transactional void capacityConstraintsPreventInvalidAvailability() {
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE activite SET places_disponibles = capacite + 1 WHERE slug = 'chocolat'"));
    }

    @Test @Transactional void timestampsUseTheBelgianCalendarDate() {
        jdbc.update("UPDATE activite SET debut = TIMESTAMPTZ '2026-10-24 23:30:00+00' WHERE slug = 'chocolat'");
        var start = repository.findPublishedBySlug("chocolat").orElseThrow().startsAt();
        assertEquals("2026-10-25", start.toLocalDate().toString());
        assertEquals("+02:00", start.getOffset().toString());
    }

    @Test @Transactional void existingDurationBackfillAndStartChangesKeepTheEndConsistent() {
        var hours=jdbc.queryForObject("SELECT extract(epoch FROM fin-debut)/3600 FROM activite WHERE slug='chocolat'",java.math.BigDecimal.class);
        assertEquals(3, hours.intValue());
        jdbc.update("UPDATE activite SET debut=debut + interval '1 day' WHERE slug='chocolat'");
        var moved=jdbc.queryForObject("SELECT extract(epoch FROM fin-debut)/3600 FROM activite WHERE slug='chocolat'",java.math.BigDecimal.class);
        assertEquals(3, moved.intValue());
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE activite SET fin=debut WHERE slug='chocolat'"));
    }

    @Test @Transactional void pricesCannotBeNegative() {
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE activite SET prix = -1 WHERE slug = 'chocolat'"));
    }
}
