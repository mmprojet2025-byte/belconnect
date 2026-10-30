import { Platform } from 'react-native';

export type Activity = {
  id: string; title: string; category: string; city: string; location: string; host: string;
  image: string; startsAt: string; price: number; description: string; badge?: string; demonstration: boolean;
  likeCount: number; likedByMe: boolean; commentCount: number;
  details: { duration: string; audience: string; meetingPoint: string; preparation: string; capacity: number; remaining: number; program: string[]; included: string[] };
};

const localUrl = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://127.0.0.1:8080';
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || localUrl).replace(/\/$/, '');

function isActivity(value: unknown): value is Activity {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Activity>;
  return typeof item.id === 'string' && typeof item.title === 'string' && typeof item.city === 'string' &&
    typeof item.startsAt === 'string' && typeof item.price === 'number' && !!item.details && Number.isInteger(item.details.remaining);
}

async function request<T>(path: string, signal?: AbortSignal, token?: string | null): Promise<T> {
  const timeout = AbortSignal.timeout(12_000);
  const response = await fetch(`${apiUrl}${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getActivities(signal?: AbortSignal, token?: string | null): Promise<Activity[]> {
  const data = await request<unknown>('/api/activities', signal, token);
  if (!Array.isArray(data)) throw new Error('Réponse invalide');
  return data.filter(isActivity);
}

export async function getActivity(id: string, signal?: AbortSignal, token?: string | null): Promise<Activity> {
  const data = await request<unknown>(`/api/activities/${encodeURIComponent(id)}`, signal, token);
  if (!isActivity(data)) throw new Error('Activité invalide');
  return data;
}

export async function setActivityLike(id: string, token: string, liked: boolean): Promise<Pick<Activity, 'likeCount' | 'likedByMe'>> {
  const response = await fetch(`${apiUrl}/api/activities/${encodeURIComponent(id)}/like`, {
    method: liked ? 'PUT' : 'DELETE',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'Votre session a expiré. Reconnectez-vous.' : 'Impossible de modifier ce J’aime.');
  return response.json() as Promise<Pick<Activity, 'likeCount' | 'likedByMe'>>;
}
