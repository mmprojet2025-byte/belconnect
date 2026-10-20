// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountPage } from './pages/AccountPage';
import { CatalogProvider } from './context/CatalogContext';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('charge les outils d’organisation seulement après ouverture de la rubrique', async () => {
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
  expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace')).toBe(false);
  fireEvent.click(screen.getByRole('link', { name: /Mes espaces et groupes/ }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace')).toBe(true));
  expect(document.getElementById('workspace-title')?.textContent).toBe('Mes espaces et groupes');
  expect(screen.getByRole('link', { name: /Mes espaces et groupes/ }).getAttribute('aria-current')).toBe('page');
});

it('rend le suivi propriétaire accessible dès l’ouverture de Mon espace', async () => {
  window.history.replaceState(null, '', '/mon-espace');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace/owner/access' ? true : input === '/api/workspace'
      ? { owner: true, spaces: [], groups: [], projects: [], managedSpaces: [] }
      : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 13, firstName: 'Noor', lastName: 'Test', email: 'owner@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  fireEvent.click(await screen.findByRole('link', { name: 'Suivi de Belconnect' }));
  expect(screen.getByRole('link', { name: 'Suivi de Belconnect' }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByRole('link', { name: 'Mes participations' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Mes projets' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Demandes d’ouverture' })).toBeTruthy();
  expect(await screen.findByText('0 espaces actifs hors démo')).toBeTruthy();
});
