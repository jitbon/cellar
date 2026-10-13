import type { AuthService, AuthUser } from '@cellar/core';
import type { SupabaseClient, User } from '@supabase/supabase-js';

function toUser(user: User | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? '' } : null;
}

export class SupabaseAuthService implements AuthService {
  private user: AuthUser | null = null;
  /** Resolves once the persisted session (if any) has been read. */
  readonly ready: Promise<void>;

  constructor(private readonly client: SupabaseClient) {
    this.ready = client.auth.getSession().then(({ data }) => {
      this.user = toUser(data.session?.user);
    });
    client.auth.onAuthStateChange((_event, session) => {
      this.user = toUser(session?.user);
    });
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async signIn(email: string, password: string): Promise<{ deletionCancelled: boolean }> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data, error: rpcError } = await this.client.rpc('cancel_account_deletion');
    if (rpcError) throw rpcError;
    return { deletionCancelled: data === true };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async requestAccountDeletion(): Promise<void> {
    const { error } = await this.client.rpc('request_account_deletion');
    if (error) throw error;
  }

  currentUser(): AuthUser | null {
    return this.user;
  }

  onAuthChange(cb: (user: AuthUser | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      cb(toUser(session?.user));
    });
    return () => data.subscription.unsubscribe();
  }
}
