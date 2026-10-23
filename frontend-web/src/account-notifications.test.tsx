// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountNotifications } from './components/AccountNotifications';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('classe les demandes et annulations par date et ouvre la bonne rubrique', async () => {
  const fetcher = vi.fn((input: string, options?: RequestInit) => options?.method === 'POST' ? Promise.resolve(new Response(null, { status: 204 })) : Promise.resolve(new Response(JSON.stringify(
    input === '/api/notifications' ? [{ id: 1, title: 'Atelier', createdAt: '2026-10-20T10:00:00Z' }]
      : input === '/api/workspace/notifications' ? [{ id: 1, requestId: 12, name: 'Espace local', event: 'DEMANDE_APPROUVEE', createdAt: '2026-10-22T10:00:00Z' }]
      : input === '/api/group-memberships/notifications' ? [{ id: 1, requestId: 13, spaceId: 2, groupName: 'Groupe local', event: 'DEMANDE_ACCEPTEE', createdAt: '2026-10-21T10:00:00Z' }]
      : input === '/api/auth/csrf' ? { headerName: 'X-CSRF-TOKEN', token: 'test' } : {}), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  const bookings = vi.fn(); const requests = vi.fn();
  render(<AccountNotifications owner={false} onOpenBookings={bookings} onOpenRequests={requests} />);
  const cards = await screen.findAllByRole('article');
  expect(cards.map(card => card.textContent)).toEqual([expect.stringContaining('Espace approuvé'), expect.stringContaining('Adhésion acceptée'), expect.stringContaining('Activité annulée')]);
  fireEvent.click(cards[0].querySelector('a')!);
  await waitFor(() => expect(requests).toHaveBeenCalledOnce());
  expect(bookings).not.toHaveBeenCalled();
  expect(fetcher.mock.calls.some(([url, options]) => url === '/api/workspace/notifications/1/read' && options?.method === 'POST')).toBe(true);
});
