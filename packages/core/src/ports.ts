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
