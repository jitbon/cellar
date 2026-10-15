import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useServices } from '../state/services';
import styles from './Auth.module.css';

/** Only same-origin absolute paths are allowed as a post-sign-in destination. */
export function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function SignIn() {
  const { auth } = useServices();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { deletionCancelled } = await auth.signIn(email, password);
      if (deletionCancelled) setCancelled(true);
      else navigate(safeReturnTo(params.get('returnTo')), { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <p className={styles.wordmark}>Cellar</p>
        <h1>Sign in</h1>
        {cancelled ? (
          <>
            <Banner>Your account deletion was cancelled</Banner>
            <Button
              variant="primary"
              onClick={() => navigate(safeReturnTo(params.get('returnTo')))}
            >
              Continue
            </Button>
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
            />
            <Button type="submit" variant="primary" disabled={busy}>
              Sign in
            </Button>
          </form>
        )}
        <div className={styles.links}>
          <Link to="/signup">Create an account</Link>
          <Link to="/reset-password">Forgot your password?</Link>
        </div>
      </main>
    </div>
  );
}
