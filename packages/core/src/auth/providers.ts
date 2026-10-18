import type { SignInMethod, SignInProvider } from '../ports';

export type ProviderCallbackKind =
  'signed-in' | 'cancelled' | 'email-not-verified' | 'no-email' | 'error';

/** Providers in the order their buttons appear. */
export const SIGN_IN_PROVIDERS: readonly SignInProvider[] = ['google', 'apple', 'facebook'];

/** Display names; email shows as "Email and password". */
export const METHOD_LABEL: Record<SignInMethod, string> = {
  email: 'Email and password',
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
};

const METHOD_ORDER: readonly SignInMethod[] = ['email', ...SIGN_IN_PROVIDERS];

/**
 * Ordered, de-duplicated known methods from the account service's provider list. Unknown
 * entries (other providers, nulls) are ignored; anything that is not an array gives [].
 */
export function signInMethods(providers: unknown): SignInMethod[] {
  if (!Array.isArray(providers)) return [];
  return METHOD_ORDER.filter((m) => providers.includes(m));
}

/**
 * Maps the parameters of the redirect back from the account service (query and fragment merged)
 * to an outcome kind: a session means signed in; otherwise the error says why not.
 */
export function providerCallbackKind(params: URLSearchParams): ProviderCallbackKind {
  const error = params.get('error');
  const code = params.get('error_code');
  if (!error && !code) return params.get('access_token') ? 'signed-in' : 'error';
  if (code === 'provider_email_needs_verification') return 'email-not-verified';
  if (/user email/i.test(params.get('error_description') ?? '')) return 'no-email';
  if (error === 'access_denied') return 'cancelled';
  return 'error';
}

/** Message for a failed outcome, naming the provider when known. */
export function providerMessage(
  kind: Exclude<ProviderCallbackKind, 'signed-in'>,
  provider: SignInProvider | null,
): string {
  const name = provider ? METHOD_LABEL[provider] : null;
  switch (kind) {
    case 'cancelled':
      return name ? `Sign-in with ${name} was cancelled.` : 'Sign-in was cancelled.';
    case 'email-not-verified':
      return `${name ?? 'Your provider'} didn't confirm your email. Sign in with your email and password instead.`;
    case 'no-email':
      return `${name ?? 'Your provider'} didn't share an email address. Allow email access or use another option.`;
    case 'error':
      return name
        ? `Couldn't sign in with ${name}. Try again or use another option.`
        : "Couldn't sign in. Try again or use another option.";
  }
}
