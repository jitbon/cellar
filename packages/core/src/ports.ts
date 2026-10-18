import type { Change } from './commands/command';
import type {
  CityPhoto,
  Forecast,
  Location,
  Place,
  PlaceSuggestion,
  PopularList,
  Trip,
  TripState,
} from './model/types';

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

/** Identity providers a person can sign in with (besides email and password). */
export type SignInProvider = 'google' | 'apple' | 'facebook';

/** A way of signing in to an account. */
export type SignInMethod = 'email' | SignInProvider;

/** Result of returning from a provider's sign-in screen (see `providerCallbackKind`). */
export type ProviderSignInOutcome =
  | { kind: 'signed-in'; provider: SignInProvider; deletionCancelled: boolean; returnTo: string }
  | {
      kind: 'cancelled' | 'email-not-verified' | 'no-email' | 'error';
      /** Null when the pending sign-in is unknown (another tab, expired). */
      provider: SignInProvider | null;
      /** The page the person started from ('/signin' or '/signup'). */
      returnTo: string;
    };

export interface AuthUser {
  id: string;
  email: string;
  /** How this account can sign in, ordered email, google, apple, facebook. */
  methods: SignInMethod[];
}

export interface AuthService {
  signUp(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<{ deletionCancelled: boolean }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  requestAccountDeletion(): Promise<void>;
  /** Providers turned on in the account service; [] when unknown or the request fails. */
  availableProviders(): Promise<SignInProvider[]>;
  /**
   * Saves the pending sign-in (provider, from, returnTo) and leaves the page for the provider.
   * Rejects only if the redirect could not start (the page stays; caller shows the error).
   */
  startProviderSignIn(
    provider: SignInProvider,
    from: '/signin' | '/signup',
    returnTo: string,
  ): Promise<void>;
  /**
   * Called by /auth/callback. Reads the pending record and the callback URL, waits for the session
   * when tokens are present, cancels a pending account deletion after a successful sign-in, clears
   * the pending record, and never throws.
   */
  completeProviderSignIn(url: URL): Promise<ProviderSignInOutcome>;
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
  /** Up to 20 per group for the city; places in both groups appear once. Rejects on failure. */
  popular(city: Location): Promise<PopularList>;
  /** A short-lived image URL for a photo name, max width in px. Rejects on failure. */
  photoUrl(photoName: string, maxWidthPx: number): Promise<string>;
}

export interface CityPhotoService {
  /** The city's lead photo, or null when none. Rejects on failure. */
  lead(cityName: string): Promise<CityPhoto | null>;
  /** Up to `limit` landscape photos of the city (lead first). Rejects on failure. */
  more(cityName: string, limit: number): Promise<CityPhoto[]>;
  /** A specific photo by file name (for a chosen cover), or null if gone. Rejects on failure. */
  byFile(file: string): Promise<CityPhoto | null>;
}

export interface KeyValueStore {
  /** Never throws; null on any failure. */
  get(key: string): string | null;
  /** Never throws. */
  set(key: string, value: string): void;
  remove(key: string): void;
}
