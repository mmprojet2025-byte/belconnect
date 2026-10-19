package be.belconnect.backend.billing;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class SpaceCommission {
  private final JdbcTemplate jdbc;
  public SpaceCommission(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  public int percent(long spaceId) {
    Boolean pro=jdbc.queryForObject("""
      SELECT EXISTS(SELECT 1 FROM abonnement_espace WHERE espace_id=? AND formule='PRO' AND statut='ACTIF')
      """,Boolean.class,spaceId);
    return Boolean.TRUE.equals(pro)?5:8;
  }
  public long cents(long spaceId,long amountCents) {
    return (amountCents*percent(spaceId)+50)/100;
  }
}
