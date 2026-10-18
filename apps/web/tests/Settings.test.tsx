import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SignInMethod } from '@cellar/core';
import { Settings } from '../src/pages/Settings';
import { fakeAuth, fakeUser, withAuth } from './fakeAuth';

function setup(methods: SignInMethod[]) {
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
    { wrapper: withAuth(fakeAuth({ user: fakeUser(methods) })) },
  );
}

describe('Settings account section', () => {
  it('shows the email and every way of signing in', () => {
    setup(['email', 'google']);
    expect(screen.getByText('ana@example.com')).toBeVisible();
    expect(screen.getByText('Sign-in methods:').parentElement).toHaveTextContent(
      'Sign-in methods: Email and password, Google',
    );
  });

  it('shows a provider-only account as that provider alone', () => {
    setup(['google']);
    expect(screen.getByText('Sign-in methods:').parentElement).toHaveTextContent(
      /^Sign-in methods: Google$/,
    );
  });

  it('has no controls to connect or disconnect a method', () => {
    setup(['email', 'google']);
    expect(screen.queryByRole('button', { name: /connect|disconnect|link|unlink/i })).toBeNull();
  });
});
