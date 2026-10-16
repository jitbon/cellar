export type ItemType = 'activity' | 'food';
export type ISODate = string; // 'YYYY-MM-DD'

// Rows stay flat so the repository's generic column mapping keeps working.
export interface LocationFields {
  locationName: string | null;
  locationLat: number | null;
  locationLon: number | null;
  locationTz: string | null;
}

export type PlaceProvider = 'google';

// A saved snapshot of a real place, flat for the same reason as LocationFields.
export interface PlaceFields {
  placeId: string | null;
  placeProvider: PlaceProvider | null;
  placeName: string | null;
  placeAddress: string | null;
  placeLat: number | null;
  placeLon: number | null;
  placeCategory: string | null;
}

export interface Place {
  id: string;
  provider: PlaceProvider;
  name: string;
  address: string;
  lat: number;
  lon: number;
  category: string | null;
}

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  address: string;
  types: string[];
}

/** A place suggested for a city. Transient: kept in session memory only, never stored. */
export interface PopularPlace {
  placeId: string;
  name: string;
  /** Human-readable type, e.g. "Art museum"; may be empty. */
  kind: string;
  address: string;
  lat: number;
  lon: number;
  types: string[];
  rating: number | null;
  ratingCount: number | null;
}

export interface PopularList {
  city: Location;
  todo: PopularPlace[];
  food: PopularPlace[];
  fetchedAt: string;
}

export type MapApp = 'google' | 'apple' | 'waze';

export interface Trip extends LocationFields {
  id: string;
  ownerId: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  deletedAt: string | null;
  updatedAt: string;
}

export interface Block {
  id: string;
  tripId: string;
  name: string;
  position: string;
  windowStartMin: number | null;
  windowEndMin: number | null;
  /** Meal-row look: true/false when set by the traveler, null to follow the name. */
  isMeal: boolean | null;
  updatedAt: string;
}

export interface DaySetting extends LocationFields {
  tripId: string;
  date: ISODate;
  arrivalBlockId: string | null;
  departureBlockId: string | null;
  updatedAt: string;
}

export interface Item extends PlaceFields {
  id: string;
  tripId: string;
  name: string;
  type: ItemType;
  notes: string | null;
  link: string | null;
  updatedAt: string;
}

export interface Placement extends PlaceFields {
  id: string;
  tripId: string;
  date: ISODate;
  blockId: string;
  position: string;
  name: string;
  type: ItemType;
  notes: string | null;
  link: string | null;
  sourceItemId: string | null;
  updatedAt: string;
}

export interface TripState {
  trip: Trip;
  blocks: Block[];
  daySettings: DaySetting[];
  items: Item[];
  placements: Placement[];
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
  tz: string;
}

/** Minutes after local midnight, 0-1439. end < start means the window crosses midnight. */
export interface TimeWindow {
  startMin: number;
  endMin: number;
}

export type WeatherCondition =
  'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunderstorm';

export interface ForecastHour {
  /** Local time at the location, 'YYYY-MM-DDTHH:00'. */
  time: string;
  code: number;
  tempC: number;
  rainPct: number | null;
}

export interface Forecast {
  tz: string;
  hours: ForecastHour[];
  fetchedAt: string;
}

export interface CellWeather {
  condition: WeatherCondition;
  tempC: number;
  rainPct: number | null;
  fetchedAt: string;
}

export type DayForecastStatus =
  | { kind: 'no-location' }
  | { kind: 'past' }
  | { kind: 'pending'; availableFrom: ISODate }
  | { kind: 'in-range'; location: Location };
