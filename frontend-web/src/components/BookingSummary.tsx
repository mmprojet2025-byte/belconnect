import type { Activity } from "../data/activities";
import { money } from "../lib/booking";
import { Icon } from "./Icon";
export function BookingSummary({
  activity,
  quantity,
  compact = false,
}: {
  activity: Activity;
  quantity: number;
  compact?: boolean;
}) {
  return (
    <section
      className={`booking-summary ${compact ? "compact-summary" : ""}`}
      aria-label="Votre activité"
    >
      <img src={`/images/${activity.image}.jpg`} alt="" />
      <div className="summary-info">
        <span className="eyebrow teal">VOTRE PROCHAINE DÉCOUVERTE</span>
        <h2>
          <a href={`/activites/${activity.id}`}>{activity.title}</a>
        </h2>
        <p>
          <Icon name="calendar" />
          {activity.date} · {activity.details.duration}
        </p>
        <p>
          <Icon name="pin" />
          {activity.location}
        </p>
        <p>
          <Icon name="users" />
          {activity.host}
        </p>
      </div>
      <div className="summary-price">
        <span>
          {quantity} personne{quantity > 1 ? "s" : ""}
        </span>
        <strong>
          {activity.price === 0 ? "Gratuit" : money(activity.price * quantity)}
        </strong>
      </div>
    </section>
  );
}
