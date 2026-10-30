// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountNotifications } from './components/AccountNotifications';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('shows the same inbox as mobile and keeps read notifications in history', async () => {
  const notices = [
    { source: 'message', id: 4, title: 'Nora Mobile', message: 'Nouveau message reçu.', event: null, createdAt: '2026-10-23T10:00:00Z', readAt: null, conversationId: 9, spaceId: null },
    { source: 'workspace', id: 1, title: 'Espace local', message: 'Demande approuvée.', event: 'DEMANDE_APPROUVEE', createdAt: '2026-10-22T10:00:00Z', readAt: null, spaceId: null },
    { source: 'project', id: 3, title: 'Projet local', message: 'Ce projet est terminé.', event: 'TERMINE', createdAt: '2026-10-21T10:00:00Z', readAt: null, spaceId: 2 },
    { source: 'activity', id: 2, title: 'Atelier', message: 'Activité annulée.', event: null, createdAt: '2026-10-20T10:00:00Z', readAt: '2026-10-20T11:00:00Z', spaceId: null },
  ];
  const fetcher = vi.fn((input: string, options?: RequestInit) => options?.method === 'POST'
    ? Promise.resolve(new Response(null, { status: 204 }))
    : Promise.resolve(new Response(JSON.stringify(input === '/api/mobile/notifications' ? notices : { headerName: 'X-CSRF-TOKEN', token: 'test' }), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  const bookings = vi.fn(); const requests = vi.fn();
  render(<AccountNotifications owner={false} onOpenBookings={bookings} onOpenRequests={requests} />);
  const cards = await screen.findAllByRole('article');
  expect(cards.map(card => card.textContent)).toEqual([expect.stringContaining('Nouveau message'), expect.stringContaining('Espace approuvé'), expect.stringContaining('Projet terminé'), expect.stringContaining('Activité annulée')]);
  expect(cards[0].textContent).not.toContain('contenu privé');
  fireEvent.click(cards[1].querySelector('a')!);
  await waitFor(() => expect(requests).toHaveBeenCalledOnce());
  expect(bookings).not.toHaveBeenCalled();
  expect(fetcher.mock.calls.some(([url, options]) => url === '/api/mobile/notifications/workspace/1/read' && options?.method === 'POST')).toBe(true);
  expect(await screen.findAllByRole('article')).toHaveLength(4);
});

it('opens a group invitation from the notification itself', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify([
    { source: 'group-invite', id: 7, title: 'Voyages', message: 'Vous êtes invité à rejoindre ce groupe privé.', event: 'EN_ATTENTE', createdAt: '2026-10-30T10:00:00Z', readAt: null, spaceId: 3 },
  ]), { status: 200 }))));
  render(<AccountNotifications owner={false} onOpenBookings={vi.fn()} onOpenRequests={vi.fn()} />);
  const link = await screen.findByRole('link', { name: /invitation à un groupe.*voyages/i });
  expect(link.getAttribute('href')).toBe('/groupes#invitations');
});
