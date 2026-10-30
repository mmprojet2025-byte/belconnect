// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Groups } from './pages/Groups';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); });

it('opens one invitation without showing the group catalogue', async () => {
  window.history.replaceState(null, '', '/groupes?invitationDirecte=7');
  vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === '/api/groups/invitations/mine'
    ? [{ id: 7, groupId: 3, groupName: 'Voyages', spaceName: 'Restaurent', status: 'EN_ATTENTE', createdAt: '2026-10-30T10:00:00Z' }]
    : []), { status: 200 }))));
  render(<Groups signedIn />);
  expect(await screen.findByRole('heading', { name: 'Voyages' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Accepter l’invitation' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Trouvez votre communauté' })).toBeNull();
});
