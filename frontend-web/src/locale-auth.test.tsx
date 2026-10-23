// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { AuthPage } from './pages/AuthPage';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage';
import { setLocale } from './lib/locale';

afterEach(() => { cleanup(); localStorage.clear(); });

it('changes the sign-in page language without changing the form', () => {
  setLocale('en');
  render(<AuthPage user={null} onComplete={() => {}} onLogout={async () => {}} />);
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign in and continue' })).toBeTruthy();
  act(() => setLocale('nl'));
  expect(screen.getByRole('heading', { name: 'Welkom terug' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Aanmelden en doorgaan' })).toBeTruthy();
});

it('translates the recovery screen', () => {
  setLocale('nl');
  render(<PasswordRecoveryPage />);
  expect(screen.getByRole('heading', { name: 'Wachtwoord vergeten?' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Stuur mij de link' })).toBeTruthy();
});
