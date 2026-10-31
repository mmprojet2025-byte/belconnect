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
export type GroupInvitation = { id: number; groupId: number; groupName: string; spaceName: string; status: string; createdAt: string };

export async function getGroupInvitations(token: string, signal?: AbortSignal): Promise<GroupInvitation[]> {
  const response = await fetch(`${apiUrl}/api/groups/invitations/mine`, { signal, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Impossible de charger les invitations.');
  return response.json() as Promise<GroupInvitation[]>;
}

export async function answerGroupInvitation(id: number, decision: 'accept' | 'decline', token: string): Promise<void> {
  const response = await fetch(`${apiUrl}/api/groups/invitations/${id}/${decision}`, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  if (response.status === 409 && decision === 'accept') throw new Error('Vous êtes déjà membre de deux groupes. Vous ne pouvez pas en rejoindre un troisième.');
  if (!response.ok) throw new Error('Impossible de répondre à cette invitation.');
}

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
    if (response.status === 409) throw new Error('Vous êtes déjà membre de deux groupes. Vous ne pouvez pas en rejoindre un troisième.');
    throw new Error('La demande d’adhésion n’a pas pu être envoyée.');
  }
}

export async function leaveGroup(id: number, token: string): Promise<void> {
  const response = await fetch(`${apiUrl}/api/groups/${id}/membership`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 409) throw new Error('Transférez votre rôle de référent avant de quitter ce groupe.');
  if (!response.ok) throw new Error('Impossible de quitter ce groupe pour le moment.');
}
