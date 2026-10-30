import { apiUrl } from '@/lib/api';

export type Group = {
  id: number;
  name: string;
  description: string;
  coverUrl: string;
  spaceName: string;
  openMembership: boolean;
  visibility: string;
  membershipStatus: string;
};

export async function getGroups(signal?: AbortSignal, token?: string | null): Promise<Group[]> {
  const response = await fetch(`${apiUrl}/api/groups`, { signal, headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) throw new Error('Impossible de charger les groupes.');
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Réponse des groupes invalide.');
  return data as Group[];
}

export async function joinGroup(id: number, token: string): Promise<void> {
  const response = await fetch(`${apiUrl}/api/groups/${id}/join`, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Votre session a expiré. Reconnectez-vous.');
    throw new Error('La demande d’adhésion n’a pas pu être envoyée.');
  }
}
