import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
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
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Settings</h1>
        <Link to="/">‹ Trips</Link>
      </header>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <p>
        Signed in as <strong>{user?.email}</strong>
      </p>
      <div className={styles.actions}>
        <Button onClick={() => void onSignOut()}>Sign out</Button>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      </div>
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
  );
}
