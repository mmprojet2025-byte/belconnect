import { useCallback, useEffect, useState } from 'react';
import { Activity, getActivities } from '@/lib/api';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    setRevision(value => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    getActivities(controller.signal).then(setActivities).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return { activities, loading, error, retry };
}
