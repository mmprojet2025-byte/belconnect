import { useCallback, useEffect, useState } from 'react';
import { Activity, getActivities } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

export function useActivities() {
  const { token } = useAuth();
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
    getActivities(controller.signal, token).then(setActivities).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, token]);
  return { activities, loading, error, retry };
}
