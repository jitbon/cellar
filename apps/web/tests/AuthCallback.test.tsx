import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ProviderSignInOutcome } from '@cellar/core';
import { AuthCallback } from '../src/pages/AuthCallback';
import { SignIn } from '../src/pages/SignIn';
import { SignUp } from '../src/pages/SignUp';
import { fakeAuth, withAuth } from './fakeAuth';

function setup(outcome: ProviderSignInOutcome | Promise<ProviderSignInOutcome>) {
  const auth = fakeAuth({ providers: [] });
  auth.completeProviderSignIn.mockImplementation(async () => outcome);
  render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<p>Trip list</p>} />
        <Route path="/trips/:id" element={<p>The trip</p>} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: withAuth(auth) },
  );
  return auth;
}

describe('AuthCallback', () => {
  it('shows a status message while signing in', () => {
    setup(new Promise(() => {}));
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');
  });

  it('goes to the saved destination after signing in', async () => {
    setup({
      kind: 'signed-in',
      provider: 'google',
      deletionCancelled: false,
      returnTo: '/trips/t1',
    });
    expect(await screen.findByText('The trip')).toBeVisible();
  });

  it('shows the deletion-cancelled note before continuing', async () => {
    setup({
      kind: 'signed-in',
      provider: 'google',
      deletionCancelled: true,
      returnTo: '/trips/t1',
    });
    expect(await screen.findByText(/Your account deletion was cancelled/)).toBeVisible();
    expect(screen.queryByText('The trip')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('The trip')).toBeVisible();
  });

  it.each([
    ['cancelled', 'google', '/signin', 'Sign-in with Google was cancelled.'],
    [
      'email-not-verified',
      'google',
      '/signin',
      "Google didn't confirm your email. Sign in with your email and password instead.",
    ],
    [
      'no-email',
      'facebook',
      '/signup',
      "Facebook didn't share an email address. Allow email access or use another option.",
    ],
    ['error', 'apple', '/signup', "Couldn't sign in with Apple. Try again or use another option."],
    ['error', null, '/signin', "Couldn't sign in. Try again or use another option."],
  ] as const)('%s returns to %s with a message', async (kind, provider, from, message) => {
    setup({ kind, provider, returnTo: from });
    expect(await screen.findByText(message)).toBeVisible();
    // The starting page is shown with its form intact.
    expect(screen.getByLabelText('Email')).toBeVisible();
  });
});
