import { apiUrl } from '@/lib/api';

export type Project = {
  id: number;
  title: string;
  description: string;
  objective: string;
  spaceName: string;
  startsOn: string | null;
  endsOn: string | null;
  imageUrl: string | null;
  helpTypes: string[];
  participationPriceCents: number | null;
  meetingPlace: string | null;
};

export async function getProjects(signal?: AbortSignal, token?: string | null): Promise<Project[]> {
  const response = await fetch(`${apiUrl}/api/projects`, { signal, headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) throw new Error('Impossible de charger les projets.');
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Réponse des projets invalide.');
  return data as Project[];
}

export async function getProject(id: number, signal?: AbortSignal, token?: string | null): Promise<Project> {
  const response = await fetch(`${apiUrl}/api/projects/${id}`, { signal, headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) throw new Error('Projet indisponible.');
  return response.json() as Promise<Project>;
}

export const projectImages: Record<string, number> = {
  '/images/projet-jardin.jpg': require('../../assets/projects/projet-jardin.jpg'),
  '/images/projet-numerique.jpg': require('../../assets/projects/projet-numerique.jpg'),
  '/images/projet-livres.jpg': require('../../assets/projects/projet-livres.jpg'),
  '/images/projet-patrimoine.jpg': require('../../assets/projects/projet-patrimoine.jpg'),
};
