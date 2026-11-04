// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OwnerContactFeedback } from './components/OwnerContactFeedback';

describe('retours privés du propriétaire', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('affiche la liste et le détail d’un retour reçu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok:true, json:async()=>[{
      id:7,name:'Camille',email:'camille@example.test',category:'SUGGESTION',message:'Ajouter davantage de rencontres locales.',replyRequested:true,status:'NOUVEAU',receivedAt:'2026-11-02T12:00:00Z'
    }] }));
    render(<OwnerContactFeedback />);
    expect(await screen.findByRole('heading',{name:'Retours reçus'})).toBeTruthy();
    expect(await screen.findByRole('heading',{name:'Camille'})).toBeTruthy();
    expect(screen.getByText('camille@example.test')).toBeTruthy();
    expect(screen.getAllByText('Ajouter davantage de rencontres locales.')).toHaveLength(2);
    expect(screen.getByText('Oui')).toBeTruthy();
    expect(screen.getByRole('list',{name:'Retours reçus'})).toBeTruthy();
    expect(screen.getByRole('button',{name:/SuggestionNouveauCamille/}).getAttribute('aria-pressed')).toBe('true');
  });
});
