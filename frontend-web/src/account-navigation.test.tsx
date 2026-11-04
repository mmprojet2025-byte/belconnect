// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AccountPage } from './pages/AccountPage';
import { CatalogProvider } from './context/CatalogContext';
import { WorkspaceDashboard } from './components/WorkspaceDashboard';
import { OwnerFinanceSummary } from './components/OwnerFinanceSummary';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); });
beforeEach(() => { vi.stubGlobal('scrollTo', vi.fn()); });
const overview = (extra: Record<string, unknown> = {}) => ({ owner: false, spaces: [], groups: [], projects: [], managedSpaces: [], suspendedSpaces: [], moderationNotices: [], ...extra });

it('limite le suivi administrateur à l’espace choisi', async () => {
  const fetcher = vi.fn((input: string) => Promise.resolve(new Response(input.startsWith('/api/workspace/charts/spaces/') ? JSON.stringify({ activities: [{ id: 9, title: 'Atelier', capacity: 10, remaining: 4, confirmedPlaces: 3 }], months: [] }) : JSON.stringify([]), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  const data = { owner: false, spaces: [{ id: 11, name: 'Premier espace', role: 'ADMINISTRATEUR' }, { id: 12, name: 'Second espace', role: 'ADMINISTRATEUR' }], groups: [], projects: [] };
  const view = render(<WorkspaceDashboard data={data} firstName="Noor" onRefresh={() => {}} />);
  expect(await screen.findByText('3 confirmées · 4 disponibles / 10')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Espace suivi' }), { target: { value: '12' } });
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace/charts/spaces/12')).toBe(true));
  view.rerender(<WorkspaceDashboard data={data} firstName="Noor" refreshToken={1} onRefresh={() => {}} />);
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url === '/api/workspace/charts/spaces/12')).toHaveLength(2));
});

it('actualise les indicateurs financiers du propriétaire', async () => {
  const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ activeSpaces: 1, proSpaces: 0, paidTransactions: 2, confirmedCommissionCents: 120, pendingRefunds: 0 }), { status: 200 })));
  vi.stubGlobal('fetch', fetcher); render(<OwnerFinanceSummary />);
  expect(await screen.findByRole('heading', { name: 'Paiements et commissions' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
});

it('montre au membre sa prochaine inscription confirmée et ses groupes', async () => {
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/bookings' ? [{ id: 1, title: 'Atelier à venir', startsAt: '2099-06-20T10:00:00Z', status: 'CONFIRMEE', activityCancelled: false, quantity: 1 }] : []), { status: 200 }))));
  render(<WorkspaceDashboard data={{ owner: false, spaces: [{ id: 11, name: 'Impact Jeunes', role: 'MEMBRE' }], groups: [{ id: 21, spaceId: 11, name: 'Groupe local', role: 'MEMBRE', canManageMemberships: false }], projects: [] }} firstName="Noor" onRefresh={() => {}} />);
  expect(await screen.findByText('Atelier à venir')).toBeTruthy();
  expect(within(screen.getByRole('heading', { name: 'Groupes' }).closest('section')!).getByText('Groupe local')).toBeTruthy();
});

it('charge les droits puis navigue vers les participations du membre', async () => {
  window.history.replaceState(null, '', '/mon-espace#accueil');
  const fetcher = vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/workspace' ? overview() : []), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  render(<CatalogProvider><AccountPage user={{ id: 12, firstName: 'Noor', lastName: 'Test', email: 'noor@example.test' }} onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  const nav = await screen.findByRole('navigation', { name: 'Navigation de mon espace' });
  expect(within(nav).getByRole('link', { name: 'Tableau de bord' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(within(nav).getByRole('link', { name: 'Mes participations' }));
  await waitFor(() => expect(document.getElementById('mes-inscriptions')).not.toBeNull());
  expect(window.location.hash).toBe('#mes-inscriptions');
});

it('sépare les outils réservés au propriétaire', async () => {
  window.history.replaceState(null, '', '/mon-espace#accueil');
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/workspace' ? overview({ owner: true }) : input === '/api/workspace/owner/dashboard' ? { openingRequests: 0, reports: 0, proRequests: 0, unmanagedSpaces: 0, suspendedSpaces: 0, pendingRefunds: 0, activeSpaces: 0, activeMembers: 0 } : input === '/api/workspace/owner/dashboard/alerts' ? { failedChecks: 0, failedPayments: 0, settledPayments: 0, paymentThreshold: false, checkedAt: '2026-11-03T12:00:00Z' } : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 13, firstName: 'Noor', lastName: 'Test', email: 'owner@example.test' }} onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  const nav = await screen.findByRole('navigation', { name: 'Navigation de mon espace' });
  expect(within(nav).getByRole('link', { name: 'Demandes d’espace' })).toBeTruthy();
  expect(within(nav).getByRole('link', { name: 'Espaces organisateurs' })).toBeTruthy();
  expect(within(nav).getByRole('link', { name: 'Retours reçus' })).toBeTruthy();
  expect(within(nav).getByRole('link', { name: 'Membres et rôles' })).toBeTruthy();
  expect(within(nav).queryByRole('link', { name: 'Mes participations' })).toBeNull();
});

it('affiche les notifications et le profil lorsque la barre commune est indisponible', async () => {
  window.history.replaceState(null, '', '/mon-espace#accueil');
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/workspace' ? overview() : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 22, firstName: 'Noor', lastName: 'Test', email: 'noor@example.test' }} onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect(await screen.findByRole('link', { name: 'Notifications' })).toBeTruthy();
  expect(screen.getByLabelText('Ouvrir le profil')).toBeTruthy();
});

it('ouvre et referme le volet mobile', async () => {
  const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth'); Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
  window.history.replaceState(null, '', '/mon-espace#accueil');
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/workspace' ? overview() : []), { status: 200 }))));
  try {
    render(<CatalogProvider><AccountPage user={{ id: 23, firstName: 'Noor', lastName: 'Test', email: 'noor@example.test' }} onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
    await screen.findByRole('link', { name: 'Tableau de bord' });
    expect(document.querySelector('.account-page')?.getAttribute('data-sidebar-open')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu de mon espace' }));
    expect(document.querySelector('.account-page')?.getAttribute('data-sidebar-open')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le volet de navigation' }));
    expect(document.querySelector('.account-page')?.getAttribute('data-sidebar-open')).toBe('false');
  } finally { if (originalWidth) Object.defineProperty(window, 'innerWidth', originalWidth); }
});

it('retrouve le brouillon créé avec sa confirmation visible', async () => {
  window.history.replaceState(null, '', '/mon-espace?activite=13#mes-activites');
  const activity = { id: 13, slug: 'voyage', spaceId: 3, groupId: null, spaceName: 'BX-Jeunes Impact', groupName: null, published: false, cancelled: false, demonstration: false, version: 0, bookings: 0, pendingCancellation: 0, content: { title: 'Voyage', city: 'Bruxelles', image: 'balade', startsAt: '2099-06-20T10:00:00Z', endsAt: '2099-06-20T12:00:00Z', closesAt: '2099-06-19T18:00:00Z', capacity: 10, price: 2.46, visibility: 'PUBLIQUE' } };
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/workspace' ? overview({ spaces: [{ id: 3, name: 'BX-Jeunes Impact', role: 'ADMINISTRATEUR' }] }) : input.startsWith('/api/managed-activities/paged') ? { items: [activity], total: 1, page: 0, size: 12 } : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 19, firstName: 'Membre', lastName: 'Un', email: 'membre@example.test' }} onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect(await screen.findByRole('heading', { name: 'Voyage' })).toBeTruthy();
  expect(screen.getByText(/Votre activité a été enregistrée/)).toBeTruthy();
});
