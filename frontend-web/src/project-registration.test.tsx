// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PaidProjectParticipation } from './components/PaidProjectParticipation';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('confirme une inscription gratuite au projet sans ouvrir Stripe', async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const payload = path === '/api/project-paid-participations/offer/7'
      ? { projectId: 7, description: 'Voyage de plusieurs jours', priceCents: 0, capacity: 2, placesLeft: 2,
          active: true, paymentReady: true, commissionPercent: 8, startsAt: '2099-06-20T08:00:00Z', venue: 'Gare centrale' }
      : path === '/api/project-paid-participations/free' ? []
      : path === '/api/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'test' }
      : path === '/api/project-paid-participations/free/7' && init?.method === 'POST'
        ? { id: 11, projectId: 7, projectTitle: 'Voyage', status: 'CONFIRMEE' }
        : null;
    return new Response(JSON.stringify(payload), { status: payload === null ? 404 : 200 });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<PaidProjectParticipation projectId={7} signedIn />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmer mon inscription gratuite' }));
  expect(await screen.findByText(/Vous êtes déjà inscrit à ce projet/)).toBeTruthy();
  expect(fetcher.mock.calls.some(([path]) => String(path).includes('/api/project-paid-participations/free/7'))).toBe(true);
  expect(fetcher.mock.calls.some(([path]) => String(path).includes('checkout.stripe.com'))).toBe(false);
});
