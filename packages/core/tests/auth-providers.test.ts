import { describe, expect, it } from 'vitest';
import {
  METHOD_LABEL,
  SIGN_IN_PROVIDERS,
  providerCallbackKind,
  providerMessage,
  signInMethods,
} from '../src';

const params = (q: string) => new URLSearchParams(q);

describe('sign-in providers', () => {
  it('lists providers in display order with labels', () => {
    expect(SIGN_IN_PROVIDERS).toEqual(['google', 'apple', 'facebook']);
    expect(METHOD_LABEL).toEqual({
      email: 'Email and password',
      google: 'Google',
      apple: 'Apple',
      facebook: 'Facebook',
    });
  });

  it('orders, de-duplicates and filters sign-in methods', () => {
    expect(signInMethods(['google', 'email', 'github', null, 'google'])).toEqual([
      'email',
      'google',
    ]);
    expect(signInMethods(['facebook', 'apple', 'google', 'email'])).toEqual([
      'email',
      'google',
      'apple',
      'facebook',
    ]);
    expect(signInMethods(undefined)).toEqual([]);
    expect(signInMethods('google')).toEqual([]);
    expect(signInMethods({ 0: 'google' })).toEqual([]);
  });

  it('maps callback parameters to an outcome kind', () => {
    expect(providerCallbackKind(params('access_token=a&refresh_token=b'))).toBe('signed-in');
    expect(providerCallbackKind(params('error=access_denied'))).toBe('cancelled');
    expect(
      providerCallbackKind(
        params('error=access_denied&error_code=provider_email_needs_verification'),
      ),
    ).toBe('email-not-verified');
    expect(providerCallbackKind(params('error_code=provider_email_needs_verification'))).toBe(
      'email-not-verified',
    );
    expect(
      providerCallbackKind(
        params(
          'error=server_error&error_description=Error getting user email from external provider',
        ),
      ),
    ).toBe('no-email');
    expect(providerCallbackKind(params('error=server_error'))).toBe('error');
    expect(providerCallbackKind(params(''))).toBe('error');
    expect(providerCallbackKind(params('foo=bar'))).toBe('error');
  });

  it('words failure messages, naming the provider when known', () => {
    expect(providerMessage('cancelled', 'google')).toBe('Sign-in with Google was cancelled.');
    expect(providerMessage('email-not-verified', 'google')).toBe(
      "Google didn't confirm your email. Sign in with your email and password instead.",
    );
    expect(providerMessage('no-email', 'facebook')).toBe(
      "Facebook didn't share an email address. Allow email access or use another option.",
    );
    expect(providerMessage('error', 'apple')).toBe(
      "Couldn't sign in with Apple. Try again or use another option.",
    );
    expect(providerMessage('error', null)).toBe(
      "Couldn't sign in. Try again or use another option.",
    );
    expect(providerMessage('cancelled', null)).toBe('Sign-in was cancelled.');
    expect(providerMessage('email-not-verified', null)).toBe(
      "Your provider didn't confirm your email. Sign in with your email and password instead.",
    );
    expect(providerMessage('no-email', null)).toBe(
      "Your provider didn't share an email address. Allow email access or use another option.",
    );
  });
});
