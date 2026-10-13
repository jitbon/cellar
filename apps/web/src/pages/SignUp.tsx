import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useServices } from '../state/services';
import styles from './Auth.module.css';

export function SignUp() {
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
    <main className={styles.page}>
      <h1>Create account</h1>
      {sent ? (
        <Banner>Check your email to confirm your account, then sign in.</Banner>
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
      )}
      <div className={styles.links}>
        <Link to="/signin">Already have an account? Sign in</Link>
      </div>
    </main>
  );
}
