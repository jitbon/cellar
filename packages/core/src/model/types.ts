export type ItemType = 'activity' | 'food';
export type ISODate = string; // 'YYYY-MM-DD'

// Rows stay flat so the repository's generic column mapping keeps working.
export interface LocationFields {
  locationName: string | null;
  locationLat: number | null;
  locationLon: number | null;
  locationTz: string | null;
}

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
  updatedAt: string;
}

export interface DaySetting extends LocationFields {
  tripId: string;
  date: ISODate;
  arrivalBlockId: string | null;
  departureBlockId: string | null;
  updatedAt: string;
}

export interface Item {
  id: string;
  tripId: string;
  name: string;
  type: ItemType;
  notes: string | null;
  link: string | null;
  updatedAt: string;
}

export interface Placement {
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
