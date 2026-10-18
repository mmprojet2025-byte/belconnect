import type { Activity } from "../data/activities";
import { Icon } from "./Icon";
export function ActivityCard({
  activity,
  saved,
  onSave,
}: {
  activity: Activity;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="activity-card">
      <div className="card-photo">
        <a
          href={`/activites/${activity.id}`}
          aria-label={`Découvrir : ${activity.title}`}
        >
          <img src={`/images/${activity.image}.jpg`} alt="" loading="lazy" />
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
        <button
          className={`save-button ${saved ? "saved" : ""}`}
          aria-label={`${saved ? "Retirer des" : "Ajouter aux"} favoris : ${activity.title}`}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Icon name="heart" />
        </button>
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
