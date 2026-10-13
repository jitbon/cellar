import type { Change } from './commands/command';
import type { Trip, TripState } from './model/types';

export interface TripRepository {
  listTrips(): Promise<Trip[]>;
  loadTrip(tripId: string): Promise<TripState>;
  /** Rejects on failure; the caller keeps the change in its outbox. */
  save(changes: Change[]): Promise<void>;
  listDeletedTrips(): Promise<Trip[]>;
  deleteTrip(tripId: string): Promise<void>;
  restoreTrip(tripId: string): Promise<void>;
  subscribe(tripId: string, onChange: (c: Change) => void): () => void;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthService {
  signUp(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<{ deletionCancelled: boolean }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  requestAccountDeletion(): Promise<void>;
  currentUser(): AuthUser | null;
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
}
