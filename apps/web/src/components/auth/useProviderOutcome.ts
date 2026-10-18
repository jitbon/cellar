import { providerMessage, type SignInProvider } from '@cellar/core';
import { useLocation } from 'react-router';

const KINDS = ['cancelled', 'email-not-verified', 'no-email', 'error'] as const;

/**
 * The message for a provider sign-in that failed and sent the person back to this page
 * (the callback page leaves the outcome in router state), or null.
 */
export function useProviderOutcomeMessage(): string | null {
  const state = useLocation().state as {
    providerOutcome?: { kind?: string; provider?: SignInProvider | null };
  } | null;
  const outcome = state?.providerOutcome;
  const kind = KINDS.find((k) => k === outcome?.kind);
  return kind ? providerMessage(kind, outcome?.provider ?? null) : null;
}
