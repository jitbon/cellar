import type { Change } from './commands/command';
import type { Forecast, Location, Place, PlaceSuggestion, Trip, TripState } from './model/types';

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

export interface WeatherService {
  /** Rejects on network/provider failure. */
  forecast(location: Location): Promise<Forecast>;
  /** Up to 5 matches; empty array when nothing matches. Rejects on failure. */
  searchLocations(query: string, language: string): Promise<Location[]>;
}

export interface PlaceSearch {
  /** Up to 5 suggestions; [] when nothing matches. Rejects on any failure. */
  suggest(
    input: string,
    opts: { sessionToken: string; near: { lat: number; lon: number } | null },
  ): Promise<PlaceSuggestion[]>;
  /** Resolves a picked suggestion to a full Place. Ends the session. Rejects on failure. */
  details(suggestion: PlaceSuggestion, sessionToken: string): Promise<Place>;
}

export interface KeyValueStore {
  /** Never throws; null on any failure. */
  get(key: string): string | null;
  /** Never throws. */
  set(key: string, value: string): void;
  remove(key: string): void;
}
