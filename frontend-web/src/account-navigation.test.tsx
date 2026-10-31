// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AccountPage } from './pages/AccountPage';
import { CatalogProvider } from './context/CatalogContext';
import { WorkspaceDashboard } from './components/WorkspaceDashboard';
import { OwnerFinanceSummary } from './components/OwnerFinanceSummary';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('limite le suivi administrateur à l’espace choisi', async () => {
  const fetcher = vi.fn((input: string) => Promise.resolve(new Response(input.startsWith('/api/workspace/charts/spaces/')
    ? JSON.stringify({ activities: [{ id: 9, title: 'Atelier', capacity: 10, remaining: 4, confirmedPlaces: 3 }], months: [] })
    : JSON.stringify([]), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  const data = { owner: false, spaces: [{ id: 11, name: 'Premier espace', role: 'ADMINISTRATEUR' }, { id: 12, name: 'Second espace', role: 'ADMINISTRATEUR' }], groups: [], projects: [] };
  const view = render(<WorkspaceDashboard data={data} firstName="Noor" onRefresh={() => {}} />);
  expect(await screen.findByText('3 confirmées · 4 disponibles / 10')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Espace suivi' }), { target: { value: '12' } });
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace/charts/spaces/12')).toBe(true));
  expect(screen.getByText('3 confirmées · 4 disponibles / 10')).toBeTruthy();
  view.rerender(<WorkspaceDashboard data={data} firstName="Noor" refreshToken={1} onRefresh={() => {}} />);
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url === '/api/workspace/charts/spaces/12')).toHaveLength(2));
});

it('actualise ensemble les indicateurs et graphiques du propriétaire', async () => {
  const fetcher = vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace/owner/finance' ? { activeSpaces: 1, proSpaces: 0, paidTransactions: 0, confirmedCommissionCents: 0, pendingRefunds: 0 }
      : input === '/api/workspace/charts/owner' ? [{ month: '2026-10-01', activityCents: 0, projectCents: 0, donationCents: 0 }]
      : []), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  render(<OwnerFinanceSummary />);
  expect(await screen.findByRole('heading', { name: 'Commissions confirmées · 6 mois' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url === '/api/workspace/charts/owner')).toHaveLength(2));
  expect(fetcher.mock.calls.filter(([url]) => url === '/api/workspace/owner/finance')).toHaveLength(2);
});

it('montre au membre sa prochaine inscription confirmée et ses groupes', async () => {
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/bookings'
    ? [{ id: 1, title: 'Atelier à venir', startsAt: '2099-06-20T10:00:00Z', status: 'CONFIRMEE', activityCancelled: false, quantity: 1 }]
    : []), { status: 200 }))));
  render(<WorkspaceDashboard data={{ owner: false, spaces: [{ id: 11, name: 'Impact Jeunes', role: 'MEMBRE' }], groups: [{ id: 21, spaceId: 11, name: 'Groupe local', role: 'MEMBRE', canManageMemberships: false }], projects: [] }} firstName="Noor" onRefresh={() => {}} />);
  expect(await screen.findByRole('heading', { name: 'Atelier à venir' })).toBeTruthy();
  expect(within(screen.getByRole('complementary', { name: 'Mes espaces et participations' })).getByText('Groupe local')).toBeTruthy();
  expect(screen.queryByText('billets payés')).toBeNull();
});

it('retrouve le brouillon créé dans Mes activités avec une confirmation visible', async () => {
  window.history.replaceState(null, '', '/mon-espace?activite=13#mes-activites');
  vi.stubGlobal('scrollTo', vi.fn());
  const activity = { id: 13, slug: 'voyage', spaceId: 3, groupId: null, spaceName: 'BX-Jeunes Impact', groupName: null, published: false, cancelled: false, demonstration: false, version: 0, bookings: 0, pendingCancellation: 0,
    content: { title: 'Voyage', city: 'Bruxelles', image: 'balade', startsAt: '2099-06-20T10:00:00Z', endsAt: '2099-06-20T12:00:00Z', closesAt: '2099-06-19T18:00:00Z', capacity: 10, price: 2.46, visibility: 'PUBLIQUE' } };
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/workspace'
    ? { owner: false, spaces: [{ id: 3, name: 'BX-Jeunes Impact', role: 'ADMINISTRATEUR' }], groups: [], projects: [], managedSpaces: [] }
    : input.startsWith('/api/managed-activities/paged') ? { items: [activity], total: 1, page: 0, size: 12 } : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 19, firstName: 'Membre', lastName: 'Un', email: 'membre@example.test' }} onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect(await screen.findByRole('heading', { name: 'Voyage' })).toBeTruthy();
  expect(screen.getByText(/Votre activité a été enregistrée/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Voyage' }).closest('.workspace-card')?.classList.contains('workspace-card--new')).toBe(true);
});

it('charge les droits puis les outils d’organisation à l’ouverture de la rubrique', async () => {
  window.history.replaceState(null, '', '/mon-espace');
  vi.stubGlobal('scrollTo', vi.fn());
  const fetcher = vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/workspace'
    ? { owner: false, spaces: [], groups: [], projects: [], managedSpaces: [] }
    : []), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  render(<CatalogProvider><AccountPage user={{ id: 12, firstName: 'Noor', lastName: 'Test', email: 'noor@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect((await screen.findByRole('link', { name: 'Tableau de bord' })).getAttribute('aria-current')).toBe('page');
  expect(within(screen.getByRole('navigation', { name: 'Navigation de mon espace' })).getByRole('link', { name: /Mes participations/ }).getAttribute('href')).toBe('#mes-inscriptions');
  expect(await screen.findByRole('heading', { name: 'Bonjour Noor !' })).toBeTruthy();
  fireEvent.click(screen.getByRole('navigation', { name: 'Navigation de mon espace' }).querySelector('a[href="#mes-inscriptions"]')!);
  await waitFor(() => expect(document.getElementById('mes-inscriptions')).not.toBeNull());
  expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace')).toBe(true);
  expect(screen.queryByRole('link', { name: 'Mes activités' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Demandes à examiner' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Notifications' })).toBeTruthy();
  expect(within(screen.getByRole('navigation', { name: 'Navigation de mon espace' })).queryByRole('link', { name: 'Notifications' })).toBeNull();
  fireEvent.click(screen.getByLabelText('Ouvrir le profil'));
  expect(screen.getByRole('link', { name: 'Mon profil' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Mes espaces' }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/workspace')).toBe(true));
  expect(document.getElementById('workspace-title')?.textContent).toBe('Mes espaces');
  expect(screen.getByRole('link', { name: 'Mes espaces' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByText(/Un espace vous permet d’organiser vos groupes/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Aucun espace pour le moment' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Mes groupes' }));
  expect(document.getElementById('workspace-title')?.textContent).toBe('Mes groupes');
  expect(screen.getByRole('link', { name: 'Mes groupes' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('heading', { name: 'Aucun groupe pour le moment' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Mes espaces' }));
  expect(screen.queryByRole('button', { name: 'Demander un espace' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Mes demandes' }));
  expect(screen.queryByRole('button', { name: 'Adhésions aux groupes' })).toBeNull();
  expect(await screen.findByRole('button', { name: 'Envoyer la demande' })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: /pris connaissance des informations de confidentialité/ })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Formule souhaitée' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Suivi demande' }));
  expect(screen.getByRole('heading', { name: 'Suivi de mes demandes' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Envoyer la demande' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Mes demandes' }));
  expect(await screen.findByRole('button', { name: 'Envoyer la demande' })).toBeTruthy();
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
  expect(await screen.findByRole('link', { name: 'Demandes à examiner' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Tableau de bord' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('link', { name: 'Suivi de Belconnect' }));
  expect(screen.getByRole('link', { name: 'Suivi de Belconnect' }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByRole('link', { name: 'Mes participations' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Mes projets' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Demandes à examiner' })).toBeTruthy();
  expect(await screen.findByText('Indicateurs de la plateforme en mode test.')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Espaces organisateurs' }));
  expect(await screen.findByRole('combobox', { name: 'Espace à examiner' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Espaces actifs' })).toBeNull();
});

it('affiche les abonnements et les rôles dans deux rubriques réservées au propriétaire', async () => {
  window.history.replaceState(null, '', '/mon-espace#accueil');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace' ? { owner: true, spaces: [], groups: [], projects: [], managedSpaces: [] }
      : input === '/api/workspace/owner/subscriptions' ? [{ spaceId: 7, spaceName: 'Atelier local', spaceStatus: 'ACTIF', administrator: 'Camille', plan: 'PRO', status: 'ACTIF', periodEnd: null, stripeLinked: true }]
      : input === '/api/workspace/owner/invoices' ? { items: [], nextCursor: null, stripeConfigured: true }
      : input === '/api/workspace/owner/members/paged?page=0&search=' ? { items: [{ id: 3, name: 'Camille Test', email: 'camille@example.test', status: 'ACTIF', owner: false, roles: [{ scope: 'ESPACE', name: 'Atelier local', role: 'ADMINISTRATEUR', status: 'ACTIF' }] }], total: 1, page: 0, pageSize: 20 }
      : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 13, firstName: 'Noor', lastName: 'Test', email: 'owner@example.test' }} onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  fireEvent.click(await screen.findByRole('link', { name: 'Abonnements et factures' }));
  expect(await screen.findByText('Compte de facturation Stripe associé')).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Membres et rôles' }));
  expect(await screen.findByText('camille@example.test · Actif')).toBeTruthy();
  expect(screen.getByText(/Espace Atelier local/)).toBeTruthy();
});

it('affiche les vraies demandes et les indicateurs accessibles au propriétaire', async () => {
  window.history.replaceState(null, '', '/mon-espace#accueil');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace' ? { owner: true, spaces: [], groups: [], projects: [], managedSpaces: [] }
      : input === '/api/workspace/owner/finance' ? { activeSpaces: 3, proSpaces: 1, paidTransactions: 4, pendingRefunds: 2 }
      : input === '/api/workspace/opening-requests' ? [{ status: 'EN_ATTENTE' }, { status: 'APPROUVEE' }]
      : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 13, firstName: 'Noor', lastName: 'Test', email: 'owner@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect(await screen.findByText('Ouvertures d’espace à examiner')).toBeTruthy();
  expect(screen.getByText('3', { selector: '.dashboard-stat strong' })).toBeTruthy();
  expect(screen.getByText('1 →', { selector: '.dashboard-action-list strong' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Mes participations' })).toBeNull();
});

it('place les notifications et le profil dans la barre commune', async () => {
  window.history.replaceState(null, '', '/mon-espace#accueil');
  vi.stubGlobal('scrollTo', vi.fn());
  const host = document.createElement('div');
  host.id = 'account-header-tools';
  document.body.append(host);
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace' ? { owner: false, spaces: [], groups: [], projects: [], managedSpaces: [] } : []), { status: 200 }))));
  try {
    render(<CatalogProvider><AccountPage user={{ id: 22, firstName: 'Noor', lastName: 'Test', email: 'noor@example.test' }}
      onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
    await waitFor(() => expect(within(host).getByRole('link', { name: 'Notifications' })).toBeTruthy());
    expect(within(host).getByLabelText('Ouvrir le profil')).toBeTruthy();
    expect(document.querySelector('.account-toolbar')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Fermer le menu de mon espace' });
    expect(toggle.closest('.account-sidebar')).not.toBeNull();
    fireEvent.click(toggle);
    expect(document.querySelector('.account-page')?.getAttribute('data-sidebar-open')).toBe('false');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const compactNav = screen.getByRole('navigation', { name: 'Navigation de mon espace' });
    expect(within(compactNav).getByRole('link', { name: 'Tableau de bord' }).getAttribute('title')).toBe('Tableau de bord');
    expect(within(compactNav).getByRole('link', { name: 'Mes participations' }).querySelector('svg')).not.toBeNull();
    fireEvent.click(toggle);
    expect(document.querySelector('.account-page')?.getAttribute('data-sidebar-open')).toBe('true');
  } finally { cleanup(); host.remove(); }
});

it('ouvre le volet mobile au-dessus du contenu et le referme depuis le fond', async () => {
  const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
  window.history.replaceState(null, '', '/mon-espace#accueil');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace' ? { owner: false, spaces: [], groups: [], projects: [], managedSpaces: [] } : []), { status: 200 }))));
  try {
    render(<CatalogProvider><AccountPage user={{ id: 23, firstName: 'Noor', lastName: 'Test', email: 'noor@example.test' }}
      onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
    expect(document.querySelector('.account-page')?.getAttribute('data-sidebar-open')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu de mon espace' }));
    expect(document.querySelector('.account-page')?.getAttribute('data-sidebar-open')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le volet de navigation' }));
    expect(document.querySelector('.account-page')?.getAttribute('data-sidebar-open')).toBe('false');
  } finally {
    cleanup();
    if (originalWidth) Object.defineProperty(window, 'innerWidth', originalWidth);
  }
});

it('garde un seul espace comme contexte de gestion après navigation', async () => {
  window.history.replaceState(null, '', '/mon-espace#espaces');
  vi.stubGlobal('scrollTo', vi.fn());
  const fetcher = vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace/owner/access' ? false : input === '/api/workspace/spaces/1/management'
      ? { space: { id: 1, name: 'Espace Alpha', type: 'ASSOCIATION', description: '' }, groups: [] }
      : input === '/api/workspace'
      ? { owner: false, spaces: [
        { id: 1, name: 'Espace Alpha', role: 'ADMINISTRATEUR' },
        { id: 2, name: 'Espace Beta', role: 'ADMINISTRATEUR' },
      ], groups: [], projects: [], managedSpaces: [] }
      : input.startsWith('/api/managed-activities/paged') ? { items: [], total: 0, page: 0, size: 12 }
      : []), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  render(<CatalogProvider><AccountPage user={{ id: 14, firstName: 'Noor', lastName: 'Test', email: 'admin@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  fireEvent.click(await screen.findAllByRole('button', { name: 'Gérer cet espace' }).then(buttons => buttons[0]));
  await waitFor(() => expect(window.location.search).toBe('?espace=1'));
  expect(screen.getAllByRole('heading', { name: 'Espace Alpha' }).length).toBeGreaterThan(0);
  expect(screen.getByText('Vous administrez cet espace.')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Espace Beta' })).toBeNull();
  const management = within(screen.getByRole('navigation', { name: 'Gérer Espace Alpha' }));
  expect(document.querySelector('.workspace-management-layout > .workspace-context-navigation > .workspace-context-nav')).not.toBeNull();
  expect(management.getAllByRole('button')).toHaveLength(4);
  expect(management.queryByRole('button', { name: 'Activités' })).toBeNull();
  expect(management.getByRole('button', { name: 'Groupes' }).getAttribute('aria-current')).toBe('page');
  const workspaceLoads = fetcher.mock.calls.filter(([url]) => url === '/api/workspace').length;
  fireEvent.click(management.getByRole('button', { name: 'Projets' }));
  const projectManagement = within(await screen.findByRole('navigation', { name: 'Gérer Espace Alpha' }));
  expect(projectManagement.getByRole('button', { name: 'Projets' }).getAttribute('aria-current')).toBe('page');
  expect(within(screen.getByRole('navigation', { name: 'Gestion des projets' })).getByRole('button', { name: 'À examiner' }).getAttribute('aria-current')).toBe('page');
  expect(within(screen.getByRole('navigation', { name: 'Rubrique actuelle' })).getByText('À examiner')).toBeTruthy();
  expect(window.location.search).toBe('?espace=1&rubrique=projets-a-examiner');
  expect(fetcher.mock.calls.filter(([url]) => url === '/api/workspace')).toHaveLength(workspaceLoads);
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  fireEvent.click(projectManagement.getByRole('button', { name: 'Réglages' }));
  expect(within(await screen.findByRole('navigation', { name: 'Réglages de l’espace' })).getAllByRole('button')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Voir tous mes espaces' }));
  expect(window.location.search).toBe('?liste=1');
  expect(await screen.findByRole('heading', { name: 'Mes espaces' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Choisir un espace à gérer' })).toBeNull();
});

it('gère et crée les activités dans une rubrique distincte des espaces et groupes', async () => {
  window.history.replaceState(null, '', '/mon-espace#espaces');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace/owner/access' ? false : input === '/api/workspace'
      ? { owner: false, spaces: [
        { id: 1, name: 'Espace Alpha', role: 'ADMINISTRATEUR' },
        { id: 2, name: 'Espace Beta', role: 'MEMBRE' },
      ], groups: [], projects: [], managedSpaces: [] }
      : input.startsWith('/api/managed-activities/paged') ? { items: [], total: 0, page: 0, size: 12 }
      : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 15, firstName: 'Noor', lastName: 'Test', email: 'admin@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect(await screen.findByRole('link', { name: 'Mes activités' })).toBeTruthy();
  expect(screen.getByText('Organisateur')).toBeTruthy();
  await screen.findByRole('heading', { name: 'Mes espaces' });
  expect(screen.queryByRole('button', { name: 'Créer une activité' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Mes activités' }));
  expect(await screen.findByRole('heading', { name: 'Mes activités' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Mes activités' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button', { name: 'Créer une activité' }));
  expect(await screen.findByRole('heading', { name: 'Créer une activité' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Espace organisateur' }).textContent).toContain('Espace Alpha');
  expect(screen.getByRole('combobox', { name: 'Espace organisateur' }).textContent).not.toContain('Espace Beta');
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  expect(window.location.hash).toBe('#mes-activites');
  expect(screen.getByRole('button', { name: 'Créer une activité' })).toBeTruthy();
});

it('montre au référent uniquement les tâches de son groupe, sans réglages d’administrateur', async () => {
  window.history.replaceState(null, '', '/mon-espace#groupes');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace' ? { owner: false, spaces: [{ id: 7, name: 'Espace voisin', role: 'MEMBRE' }],
      groups: [{ id: 17, spaceId: 7, name: 'Jardin du quartier', role: 'REFERENT', canManageMemberships: false, canManageActivities: true }],
      projects: [], managedSpaces: [] } : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 18, firstName: 'Noor', lastName: 'Test', email: 'referent@example.test' }}
    onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  fireEvent.click(await screen.findByRole('link', { name: 'Mes groupes' }));
  expect(screen.getByRole('link', { name: 'Demandes à examiner' })).toBeTruthy();
  expect(await screen.findByText('Référent du groupe')).toBeTruthy();
  expect(screen.getByText('Projets et annonces · Activités')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Voir les membres →' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Voir les membres →' }));
  expect(await screen.findByRole('region', { name: 'Membres de Jardin du quartier' })).toBeTruthy();
  expect(window.location.pathname).toBe('/mon-espace');
  fireEvent.click(screen.getByRole('button', { name: '← Mes groupes' }));
  expect(screen.getByRole('button', { name: 'Voir les membres →' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Gérer cet espace' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Mes espaces' }));
  const management = within(await screen.findByRole('navigation', { name: 'Gérer Espace voisin' }));
  expect(management.queryByRole('button', { name: 'Réglages' })).toBeNull();
  expect(management.queryByRole('button', { name: 'Paiements' })).toBeNull();
  expect(management.getByRole('button', { name: 'Groupes' })).toBeTruthy();
});

it('ouvre une tâche reçue dans la rubrique du bon espace', async () => {
  window.history.replaceState(null, '', '/mon-espace#a-traiter');
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(
    input === '/api/workspace' ? { owner: false, spaces: [{ id: 7, name: 'Espace voisin', role: 'ADMINISTRATEUR' }], groups: [], projects: [], managedSpaces: [] }
      : input === '/api/group-memberships/received' ? [{ id: 5, spaceId: 7, groupName: 'Jardin', spaceName: 'Espace voisin', applicant: 'Noor Test', status: 'EN_ATTENTE', available: true }]
      : input === '/api/project-reviews' ? [{ id: 9, title: 'Potager', spaceId: 7, spaceName: 'Espace voisin', status: 'SOUMIS', canReview: true, canDecide: true }]
      : input === '/api/workspace/spaces/7/management' ? { space: { id: 7, name: 'Espace voisin', type: 'ASSOCIATION', description: '' }, groups: [] }
      : []), { status: 200 }))));
  render(<CatalogProvider><AccountPage user={{ id: 21, firstName: 'Noor', lastName: 'Test', email: 'admin@example.test' }} onLogout={async () => {}} onProfileSaved={() => {}} /></CatalogProvider>);
  expect((await screen.findByRole('link', { name: 'Examiner la demande →' })).getAttribute('href')).toBe('/mon-espace?espace=7&rubrique=adhesions#organisation');
  expect(screen.getByRole('link', { name: 'Ouvrir le projet →' }).getAttribute('href')).toBe('/mon-espace?espace=7&rubrique=projets-a-examiner#organisation');
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
