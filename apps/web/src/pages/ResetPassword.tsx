import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useAuthUser, useServices } from '../state/services';
import styles from './Auth.module.css';

/** Two modes: request a reset email, or (arriving from the emailed link, signed in) set a new password. */
export function ResetPassword() {
  const { auth } = useServices();
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await auth.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message || 'Could not send the reset email.');
    }
  }

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await auth.updatePassword(password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Could not update the password.');
    }
  }

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <p className={styles.wordmark}>Cellar</p>
        <h1>Reset password</h1>
        {user ? (
          <form className={styles.form} onSubmit={onSetPassword}>
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
            />
            <Button type="submit" variant="primary">
              Save new password
            </Button>
          </form>
        ) : sent ? (
          <Banner>If that email has an account, a reset link is on its way.</Banner>
        ) : (
          <form className={styles.form} onSubmit={onRequest}>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
            />
            <Button type="submit" variant="primary">
              Send reset link
            </Button>
          </form>
        )}
        <div className={styles.links}>
          <Link to="/signin">Back to sign in</Link>
        </div>
      </main>
    </div>
  );
}
