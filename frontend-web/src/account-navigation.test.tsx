// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AccountPage } from './pages/AccountPage';
import { CatalogProvider } from './context/CatalogContext';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('charge les droits puis les outils d’organisation à l’ouverture de la rubrique', async () => {
  window.history.replaceState(null, '', '/mon-espace');
  vi.stubGlobal('scrollTo', vi.fn());
  const fetcher = vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/workspace'
    ? { owner: false, spaces: [], groups: [], projects: [], managedSpaces: [] }
    : []), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  render(<CatalogProvider><AccountPage user={{ id: 12, firstName: 'Noor', lastName: 'Test', email: 'noor@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect((await screen.findByRole('link', { name: /Mes participations/ })).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link', { name: /Mes participations/ }).getAttribute('href')).toBe('#mes-inscriptions');
  await waitFor(() => expect(document.getElementById('mes-inscriptions')).not.toBeNull());
  expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace')).toBe(true);
  expect(screen.queryByRole('link', { name: 'Créer une activité' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Espaces et groupes' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace')).toBe(true));
  expect(document.getElementById('workspace-title')?.textContent).toBe('Mes espaces et groupes');
  expect(screen.getByRole('link', { name: 'Espaces et groupes' }).getAttribute('aria-current')).toBe('page');
  expect(await screen.findByRole('heading', { name: 'Demander un espace organisateur' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Mes demandes' }));
  expect(await screen.findByRole('heading', { name: 'Mes demandes d’espace' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Demander un espace' })).toBeNull();
});

it('sépare les demandes, les espaces et le suivi du propriétaire', async () => {
  window.history.replaceState(null, '', '/mon-espace');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace/owner/moderation' ? { spaces: [], recent: [] } : input === '/api/workspace'
      ? { owner: true, spaces: [], groups: [], projects: [], managedSpaces: [] }
      : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 13, firstName: 'Noor', lastName: 'Test', email: 'owner@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect(await screen.findByRole('link', { name: 'Demandes d’ouverture' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Suivi de Belconnect' }));
  expect(screen.getByRole('link', { name: 'Suivi de Belconnect' }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByRole('link', { name: 'Mes participations' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Mes projets' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Demandes d’ouverture' })).toBeTruthy();
  expect(await screen.findByText('Indicateurs de la plateforme en mode test.')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Espaces organisateurs' }));
  expect(await screen.findByRole('combobox', { name: 'Espace à examiner' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Espaces actifs' })).toBeNull();
});

it('garde un seul espace comme contexte de gestion après navigation', async () => {
  window.history.replaceState(null, '', '/mon-espace#espaces');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace/owner/access' ? false : input === '/api/workspace/spaces/1/management'
      ? { space: { id: 1, name: 'Espace Alpha', type: 'ASSOCIATION', description: '' }, groups: [] }
      : input === '/api/workspace'
      ? { owner: false, spaces: [
        { id: 1, name: 'Espace Alpha', role: 'ADMINISTRATEUR' },
        { id: 2, name: 'Espace Beta', role: 'ADMINISTRATEUR' },
      ], groups: [], projects: [], managedSpaces: [] }
      : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 14, firstName: 'Noor', lastName: 'Test', email: 'admin@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  fireEvent.click(await screen.findAllByRole('button', { name: 'Gérer cet espace' }).then(buttons => buttons[0]));
  await waitFor(() => expect(window.location.search).toBe('?espace=1'));
  expect(screen.getAllByRole('heading', { name: 'Espace Alpha' }).length).toBeGreaterThan(0);
  expect(screen.queryByRole('heading', { name: 'Espace Beta' })).toBeNull();
  const management = within(screen.getByRole('navigation', { name: 'Gestion de l’organisation' }));
  expect(management.getAllByRole('button')).toHaveLength(5);
  expect(management.getByRole('button', { name: 'Communauté' }).getAttribute('aria-pressed')).toBe('true');
  expect(within(screen.getByRole('navigation', { name: 'Communauté' })).getAllByRole('button')).toHaveLength(2);
  fireEvent.click(management.getByRole('button', { name: 'Réglages' }));
  expect(within(await screen.findByRole('navigation', { name: 'Réglages de l’espace' })).getAllByRole('button')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Changer d’espace' }));
  expect(window.location.search).toBe('');
  expect(await screen.findByRole('heading', { name: 'Choisir un espace à gérer' })).toBeTruthy();
});

it('ouvre le formulaire d’activité depuis la barre latérale après le choix d’un espace autorisé', async () => {
  window.history.replaceState(null, '', '/mon-espace#espaces');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace/owner/access' ? false : input === '/api/workspace'
      ? { owner: false, spaces: [
        { id: 1, name: 'Espace Alpha', role: 'ADMINISTRATEUR' },
        { id: 2, name: 'Espace Beta', role: 'MEMBRE' },
      ], groups: [], projects: [], managedSpaces: [] }
      : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 15, firstName: 'Noor', lastName: 'Test', email: 'admin@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect(await screen.findByRole('link', { name: 'Créer une activité' })).toBeTruthy();
  await screen.findByRole('heading', { name: 'Mes espaces et groupes' });
  expect(screen.queryByRole('button', { name: 'Créer une activité' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Créer une activité' }));
  expect(await screen.findByRole('heading', { name: 'Choisir un espace pour l’activité' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Espace Alpha' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Espace Beta' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Espace Alpha' }));
  await waitFor(() => expect(window.location.search).toBe('?espace=1&creation=activite'));
  expect(await screen.findByRole('heading', { name: 'Créer une activité' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  expect(window.location.search).toBe('?espace=1');
  expect(screen.queryByRole('button', { name: 'Créer une activité' })).toBeNull();
});

it('avertit avant de quitter un formulaire modifié depuis la barre latérale', async () => {
  window.history.replaceState(null, '', '/mon-espace#mon-profil');
  vi.stubGlobal('scrollTo', vi.fn());
  const confirm = vi.fn(() => false);
  vi.stubGlobal('confirm', confirm);
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace' ? { owner: false, spaces: [], groups: [], projects: [], managedSpaces: [] } : []
  ), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 16, firstName: 'Noor', lastName: 'Test', email: 'noor@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  fireEvent.change(await screen.findByRole('textbox', { name: 'Prénom' }), { target: { value: 'Noura' } });
  fireEvent.click(screen.getByRole('link', { name: 'Mes projets' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.getByRole('heading', { name: 'Mon profil' })).toBeTruthy();
  expect(window.location.hash).toBe('#mon-profil');
});
