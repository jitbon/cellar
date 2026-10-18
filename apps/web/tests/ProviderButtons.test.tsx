import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProviderButtons } from '../src/components/auth/ProviderButtons';
import { fakeAuth, withAuth } from './fakeAuth';

function setup(auth: ReturnType<typeof fakeAuth>, from: '/signin' | '/signup' = '/signin') {
  return render(<ProviderButtons from={from} returnTo="/trips/t1" />, { wrapper: withAuth(auth) });
}

describe('ProviderButtons', () => {
  it('shows one button per available provider in the order Google, Apple, Facebook', async () => {
    // The service lists them out of order; the buttons keep the fixed order.
    setup(fakeAuth({ providers: ['facebook', 'google', 'apple'] }));
    const buttons = await screen.findAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Continue with Google',
      'Continue with Apple',
      'Continue with Facebook',
    ]);
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeVisible();
  });

  it('shows only the providers that are on', async () => {
    setup(fakeAuth({ providers: ['google'] }));
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
  });

  it('renders nothing when no provider is on', async () => {
    const auth = fakeAuth({ providers: [] });
    const { container } = setup(auth);
    await waitFor(() => expect(auth.availableProviders).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the provider list cannot be read', async () => {
    const auth = fakeAuth({ providersFail: true });
    const { container } = setup(auth);
    await waitFor(() => expect(auth.availableProviders).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('starts sign-in once and disables every button while it is pending', async () => {
    const auth = fakeAuth({ providers: ['google', 'apple'] });
    auth.startProviderSignIn.mockReturnValue(new Promise(() => {}));
    setup(auth, '/signup');
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(auth.startProviderSignIn).toHaveBeenCalledTimes(1);
    expect(auth.startProviderSignIn).toHaveBeenCalledWith('google', '/signup', '/trips/t1');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeDisabled();
  });

  it('re-enables the buttons and explains when the redirect cannot start', async () => {
    const auth = fakeAuth({ providers: ['google', 'apple'], startFails: true });
    setup(auth);
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(
      await screen.findByText("Couldn't sign in with Google. Try again or use another option."),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeEnabled();
  });
});
