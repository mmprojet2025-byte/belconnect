import type { Activity } from "../data/activities";
import { Icon } from "./Icon";
export function ActivityCard({
  activity,
}: {
  activity: Activity;
}) {
  return (
    <article className="activity-card">
      <div className="card-photo">
        <a
          href={`/activites/${activity.id}`}
          aria-label={`Découvrir : ${activity.title}`}
        >
          <img src={`/images/${activity.image}.jpg`} alt="" loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/visuel-indisponible.svg'; }} />
        </a>
        {(activity.details.remaining === 0 ||
          activity.price === 0 ||
          activity.badge) && (
          <span className={`badge ${activity.price === 0 ? "free" : ""}`}>
            {activity.details.remaining === 0
              ? "Complet"
              : activity.price === 0
                ? "Gratuit"
                : activity.badge}
          </span>
        )}
      </div>
      <div className="card-content">
        <span className="card-date">{activity.date}</span>
        <h3>
          <a href={`/activites/${activity.id}`}>{activity.title}</a>
        </h3>
        <p className="card-location">
          <Icon name="pin" />
          {activity.location}
        </p>
        <div className="card-bottom">
          <span>{activity.host}</span>
          <strong>
            {activity.price === 0 ? "Gratuit" : `${activity.price} €`}
          </strong>
        </div>
      </div>
    </article>
  );
}
