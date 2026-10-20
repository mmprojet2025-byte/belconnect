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
  expect(screen.getByRole('link', { name: /Mes participations/ }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link', { name: /Mes participations/ }).getAttribute('href')).toBe('#mes-inscriptions');
  expect(document.getElementById('mes-inscriptions')).not.toBeNull();
  expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace')).toBe(false);
  fireEvent.click(screen.getByRole('link', { name: /Mes espaces et groupes/ }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace')).toBe(true));
  expect(document.getElementById('workspace-title')?.textContent).toBe('Mes espaces et groupes');
  expect(screen.getByRole('link', { name: /Mes espaces et groupes/ }).getAttribute('aria-current')).toBe('page');
});
