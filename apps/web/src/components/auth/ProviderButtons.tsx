import { useEffect, useState } from 'react';
import {
  METHOD_LABEL,
  SIGN_IN_PROVIDERS,
  providerMessage,
  type SignInProvider,
} from '@cellar/core';
import { useServices } from '../../state/services';
import { Banner } from '../ui/Banner';
import { ProviderMark } from './ProviderMarks';
import styles from './ProviderButtons.module.css';

interface Props {
  /** The page showing the buttons; a failed sign-in returns here. */
  from: '/signin' | '/signup';
  /** Where to go after signing in. */
  returnTo: string;
}

/**
 * "Continue with {Provider}" buttons for the providers that are turned on, then an "or" divider.
 * Renders nothing when none are on or the list cannot be read, so email sign-in is unaffected.
 */
export function ProviderButtons({ from, returnTo }: Props) {
  const { auth } = useServices();
  const [providers, setProviders] = useState<SignInProvider[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<SignInProvider | null>(null);

  useEffect(() => {
    let active = true;
    auth
      .availableProviders()
      .then((list) => active && setProviders(SIGN_IN_PROVIDERS.filter((p) => list.includes(p))))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [auth]);

  async function start(provider: SignInProvider) {
    setFailed(null);
    setBusy(true);
    try {
      await auth.startProviderSignIn(provider, from, returnTo);
      // The page is leaving for the provider; keep the buttons disabled until it does.
    } catch {
      setFailed(provider);
      setBusy(false);
    }
  }

  if (providers.length === 0) return null;

  return (
    <>
      <div className={styles.group}>
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            className={`${styles.button} ${provider === 'apple' ? styles.apple : ''}`}
            disabled={busy}
            onClick={() => void start(provider)}
          >
            <ProviderMark provider={provider} />
            Continue with {METHOD_LABEL[provider]}
          </button>
        ))}
      </div>
      {failed ? (
        <div className={styles.error}>
          <Banner tone="error">{providerMessage('error', failed)}</Banner>
        </div>
      ) : null}
      <p className={styles.divider}>or</p>
    </>
  );
}
