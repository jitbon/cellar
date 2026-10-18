import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ProviderButtons } from '../components/auth/ProviderButtons';
import { useProviderOutcomeMessage } from '../components/auth/useProviderOutcome';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { safeReturnTo } from '../lib/returnTo';
import { useServices } from '../state/services';
import styles from './Auth.module.css';

export function SignUp() {
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [params] = useSearchParams();
  const providerMessage = useProviderOutcomeMessage();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await auth.signUp(email, password);
      setSent(true);
    } catch (err) {
      setError((err as Error).message || 'Could not sign up.');
    }
  }

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <p className={styles.wordmark}>Cellar</p>
        <h1>Create account</h1>
        {providerMessage ? <Banner tone="error">{providerMessage}</Banner> : null}
        {sent ? (
          <Banner>Check your email to confirm your account, then sign in.</Banner>
        ) : (
          <>
            <ProviderButtons from="/signup" returnTo={safeReturnTo(params.get('returnTo'))} />
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
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error}
              />
              <Button type="submit" variant="primary">
                Sign up
              </Button>
            </form>
          </>
        )}
        <div className={styles.links}>
          <Link to="/signin">Already have an account? Sign in</Link>
        </div>
      </main>
    </div>
  );
}
