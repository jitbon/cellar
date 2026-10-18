import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { useServices } from '../state/services';
import styles from './Auth.module.css';

/**
 * Where a provider sends the person back to. Finishes sign-in, then continues to the saved
 * destination; a cancelled or failed sign-in returns to the page it started from with the
 * outcome in router state, which that page shows as a message.
 */
export function AuthCallback() {
  const { auth } = useServices();
  const navigate = useNavigate();
  const [continueTo, setContinueTo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void auth.completeProviderSignIn(new URL(window.location.href)).then((outcome) => {
      if (!active) return;
      if (outcome.kind !== 'signed-in') {
        navigate(outcome.returnTo, {
          replace: true,
          state: { providerOutcome: { kind: outcome.kind, provider: outcome.provider } },
        });
      } else if (outcome.deletionCancelled) setContinueTo(outcome.returnTo);
      else navigate(outcome.returnTo, { replace: true });
    });
    return () => {
      active = false;
    };
  }, [auth, navigate]);

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <p className={styles.wordmark}>Cellar</p>
        {continueTo ? (
          <>
            <Banner>Your account deletion was cancelled</Banner>
            <Button variant="primary" onClick={() => navigate(continueTo, { replace: true })}>
              Continue
            </Button>
          </>
        ) : (
          <p role="status">Signing you in…</p>
        )}
      </main>
    </div>
  );
}
