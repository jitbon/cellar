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

/** A provider photo of a place. The name expires, so it is session memory only, never stored. */
export interface PlacePhotoRef {
  name: string;
  author: string;
  authorUri: string | null;
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
  /** The first provider photo, or null when the place has none. */
  photo: PlacePhotoRef | null;
}

/** A day and time in the provider's opening-hours convention. */
export interface DayTime {
  /** 0..6, Sunday = 0. */
  day: number;
  hour: number;
  minute: number;
}

/** Regular opening hours as the provider reports them. */
export interface WeeklyHours {
  periods: { open: DayTime; close: DayTime | null }[];
}

/** What the provider knows about one place. Session memory only, never stored. */
export interface PlaceInfo {
  placeId: string;
  name: string;
  /** Human-readable type, e.g. "Market"; may be empty. */
  kind: string;
  types: string[];
  rating: number | null;
  ratingCount: number | null;
  photo: PlacePhotoRef | null;
  /** Null when the provider has no hours. */
  hours: WeeklyHours | null;
  /** The place's current UTC offset in minutes, when known. */
  utcOffsetMinutes: number | null;
  /** Only http(s) addresses are kept. */
  website: string | null;
}

/** One day's opening hours in the place's local time. */
export interface HoursLine {
  /** 0..6, Sunday = 0. */
  day: number;
  kind: 'closed' | 'open-24h' | 'open';
  /** Minutes since local midnight; closeMin may exceed 1440 for past-midnight closing. */
  ranges: { openMin: number; closeMin: number }[];
}

export interface OpeningHours {
  /** The place's local day. */
  today: HoursLine;
  /** Seven lines, Monday first. */
  week: HoursLine[];
}

/** A photo of a city from an openly licensed source, with what its credit line needs. */
export interface CityPhoto {
  /** Commons file name (what `Trip.coverPhoto` stores). */
  file: string;
  url: string;
  width: number;
  height: number;
  credit: string;
  license: string;
  sourceUrl: string;
}

export type TripStatus =
  | { kind: 'before'; days: number }
  | { kind: 'during'; day: number; of: number }
  | { kind: 'after' };

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
  /** Commons file name of the cover photo the traveler chose; null follows the automatic photo. */
  coverPhoto: string | null;
  /** Commons file name for the trip page's banner, chosen separately; null follows the automatic photo. */
  bannerPhoto: string | null;
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
  /** False after sunset and before sunrise; absent in forecasts cached before it was fetched. */
  isDay?: boolean;
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
  /** True when most of the window's hours are after dark, so clear skies show a moon. */
  night: boolean;
}

export type DayForecastStatus =
  | { kind: 'no-location' }
  | { kind: 'past' }
  | { kind: 'pending'; availableFrom: ISODate }
  | { kind: 'in-range'; location: Location };
