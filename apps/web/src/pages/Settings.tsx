import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Icon } from '../components/ui/Icon';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuthUser, useServices } from '../state/services';
import styles from './Trips.module.css';

export function Settings() {
  const { auth } = useServices();
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    await auth.signOut();
    navigate('/signin', { replace: true });
  }

  async function onDelete() {
    try {
      await auth.requestAccountDeletion();
      await auth.signOut();
      navigate('/signin', { replace: true });
    } catch (err) {
      setConfirming(false);
      setError((err as Error).message || 'Could not request account deletion.');
    }
  }

  return (
    <>
      <header className={styles.bar}>
        <h1 className={styles.barTitle}>Settings</h1>
        <Link to="/" className={styles.barLink}>
          <Icon as={ArrowLeft} />
          Trips
        </Link>
      </header>
      <main className={styles.settings}>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Account</h2>
          <p>
            Signed in as <strong>{user?.email}</strong>
          </p>
          <div className={styles.actionsStart}>
            <Button onClick={() => void onSignOut()}>Sign out</Button>
          </div>
        </section>
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Danger zone</h2>
          <div className={styles.actionsStart}>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete account
            </Button>
          </div>
        </section>
        {confirming ? (
          <ConfirmDialog
            title="Delete your account?"
            confirmLabel="Delete account"
            danger
            onCancel={() => setConfirming(false)}
            onConfirm={() => void onDelete()}
          >
            Your account and all your trips will be permanently deleted after 30 days. If you sign
            back in before then, the deletion is cancelled and nothing is lost.
          </ConfirmDialog>
        ) : null}
      </main>
    </>
  );
}
