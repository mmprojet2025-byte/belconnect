// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CatalogProvider } from './context/CatalogContext';
import { MyBookings } from './components/MyBookings';
import { MyPaidProjectParticipations } from './components/PaidProjectParticipation';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('affiche une simulation payante sans la présenter comme une réservation', async () => {
  localStorage.setItem('belconnect-demo-payments-42', JSON.stringify([{ activityId: 'poterie', quantity: 2, amountCents: 11000, completedAt: '2026-10-21T10:00:00Z' }]));
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
  render(<CatalogProvider><MyBookings userId={42} /></CatalogProvider>);
  expect(await screen.findByText('Simulation · aucune réservation')).toBeTruthy();
  expect(screen.getByText('Aucun paiement encaissé, aucune place réservée.')).toBeTruthy();
  expect(screen.getByText('1 au total')).toBeTruthy();
  localStorage.removeItem('belconnect-demo-payments-42');
});

it('affiche un paiement d’activité en attente même sans inscription confirmée', async () => {
  window.history.replaceState(null, '', '/mon-espace#mes-inscriptions');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input) === '/api/paid-activity-bookings' ? [{
      id: 8, activityId: 'poterie', title: 'Atelier de poterie', startsAt: '2099-06-20T10:00:00Z',
      location: 'Bruxelles', image: null, quantity: 1, amountCents: 5500, status: 'EN_ATTENTE', registrationId: null,
    }] : []), { status: 200 })));
  render(<CatalogProvider><MyBookings userId={1} /></CatalogProvider>);
  expect(await screen.findByRole('heading', { name: 'Atelier de poterie' })).toBeTruthy();
  expect(screen.getByText('Paiement en attente de confirmation')).toBeTruthy();
  expect(screen.getByText('1 au total')).toBeTruthy();
});

it('présente une inscription payante à un projet comme une carte de participation', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input) === '/api/project-paid-participations' ? [{
      id: 14, projectId: 7, projectTitle: 'Jardin partagé', spaceName: 'Association du quartier',
      imageUrl: null, startsOn: '2099-06-20', endsOn: '2099-09-20', meetingPlace: 'Bruxelles',
      priceCents: 1200, status: 'PAYE', createdAt: '2099-01-01T10:00:00Z',
    }] : []), { status: 200 })));
  render(<MyPaidProjectParticipations userId={1} />);
  expect(await screen.findByRole('heading', { name: 'Jardin partagé' })).toBeTruthy();
  expect(screen.getByText('Inscription confirmée')).toBeTruthy();
  expect(screen.getByText(/Association du quartier · 12,00/)).toBeTruthy();
  expect(screen.getByText('1 au total')).toBeTruthy();
});

it('affiche un projet de démonstration sans le confondre avec une inscription payée', async () => {
  localStorage.setItem('belconnect-demo-project-payments-42', JSON.stringify([{ projectId: 2, projectTitle: '[Démo] Projet numérique', spaceName: 'Belconnect Démo', imageUrl: null, startsOn: null, endsOn: null, priceCents: 1200, completedAt: '2026-10-21T10:00:00Z' }]));
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
  render(<MyPaidProjectParticipations userId={42} />);
  expect(await screen.findByText('Simulation · aucune inscription')).toBeTruthy();
  expect(screen.getByRole('heading', { name: '[Démo] Projet numérique' })).toBeTruthy();
  expect(screen.getByText('Aucun paiement encaissé, aucune place réservée.')).toBeTruthy();
  localStorage.removeItem('belconnect-demo-project-payments-42');
});
