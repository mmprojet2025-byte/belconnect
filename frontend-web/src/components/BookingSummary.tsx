import type { Activity } from "../data/activities";
import { money } from "../lib/booking";
import { Icon } from "./Icon";
import { tr, useLocale } from '../lib/locale';
export function BookingSummary({
  activity,
  quantity,
  compact = false,
}: {
  activity: Activity;
  quantity: number;
  compact?: boolean;
}) {
  const locale = useLocale();
  return (
    <section
      className={`booking-summary ${compact ? "compact-summary" : ""}`}
      aria-label={tr(locale, 'Votre activité', 'Your activity', 'Uw activiteit')}
    >
      <img src={`/images/${activity.image}.jpg`} alt="" />
      <div className="summary-info">
        <span className="eyebrow teal">{tr(locale, 'VOTRE PROCHAINE DÉCOUVERTE', 'YOUR NEXT DISCOVERY', 'UW VOLGENDE ONTDEKKING')}</span>
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
          {quantity} {tr(locale, quantity > 1 ? 'personnes' : 'personne', quantity > 1 ? 'people' : 'person', quantity > 1 ? 'personen' : 'persoon')}
        </span>
        <strong>
          {activity.price === 0 ? tr(locale, 'Gratuit', 'Free', 'Gratis') : money(activity.price * quantity)}
        </strong>
      </div>
    </section>
  );
}
