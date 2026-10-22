package be.belconnect.backend.activity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record ActivityView(String id, String title, String category, String city,
        String location, String host, BigDecimal price, String image,
        OffsetDateTime startsAt, OffsetDateTime endsAt, String description, String badge,
        boolean demonstration, OffsetDateTime closesAt, Details details) {
    public record Details(String duration, int capacity, int remaining, String audience,
            String meetingPoint, List<String> program, List<String> included, String preparation) {}
}
