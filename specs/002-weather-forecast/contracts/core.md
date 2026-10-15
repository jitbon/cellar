# Contract: `@cellar/core` additions

Extends [001 contracts/core.md](../../001-block-trip-planner/contracts/core.md). Everything here
is pure TypeScript with no DOM, React, or network imports (constitution III).

## Types

```ts
// Rows stay flat so the repository's generic column mapping keeps working (research R3).
interface LocationFields {
  locationName: string | null;
  locationLat: number | null;
  locationLon: number | null;
  locationTz: string | null;
}
interface Trip extends LocationFields { /* existing fields */ }
interface DaySetting extends LocationFields { /* existing fields */ }
interface Block { /* existing fields */ windowStartMin: number | null; windowEndMin: number | null; }

interface Location { name: string; lat: number; lon: number; tz: string; }
interface TimeWindow { startMin: number; endMin: number; }  // end < start = crosses midnight

type WeatherCondition =
  | 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunderstorm';

interface ForecastHour { time: string /* 'YYYY-MM-DDTHH:00' local */; code: number; tempC: number; rainPct: number | null; }
interface Forecast { tz: string; hours: ForecastHour[]; fetchedAt: string; }

interface CellWeather { condition: WeatherCondition; tempC: number; rainPct: number | null; fetchedAt: string; }

type DayForecastStatus =
  | { kind: 'no-location' }
  | { kind: 'past' }
  | { kind: 'pending'; availableFrom: ISODate }
  | { kind: 'in-range'; location: Location };
```

## Commands (pure, undoable, produce `Change[]` like existing commands)

| Command | Effect | Errors |
|---|---|---|
| `setTripLocation(location: Location \| null)` | Sets or clears the trip location | `INVALID_LOCATION` |
| `setDayLocation(date, location: Location \| null)` | Sets or clears a day's override; creates/deletes the `day_settings` row per lifecycle rule | `DATE_OUT_OF_RANGE`, `INVALID_LOCATION` |
| `setBlockWindow(blockId, window: TimeWindow)` | Sets a block's window | `NOT_FOUND`, `INVALID_WINDOW` |

Changed behavior:

- `createTrip` writes default windows on the ten default blocks.
- `addBlock` writes the suggested window (research R5).
- `setDayWindow` and `removeBlock` keep a `day_settings` row that still has a location override.

## Queries (pure)

| Query | Returns |
|---|---|
| `tripLocation(state)` | `Location \| null` |
| `dayLocation(state, date)` | Effective `Location \| null` (override ?? trip) |
| `dayLocationOverride(state, date)` | `Location \| null` (for the "📍" header badge) |
| `effectiveWindow(state, blockId)` | `TimeWindow` |
| `DEFAULT_BLOCK_WINDOWS` | `Record<string, TimeWindow>` keyed by default block name |
| `forecastLocations(state, today: (tz) => ISODate)` | Distinct `Location`s needed for in-range days (what to fetch) |
| `dayForecastStatus(state, date, today: ISODate)` | `DayForecastStatus` (`today` in the day's location tz) |
| `summarizeWindow(forecast, date, window)` | `CellWeather \| null` (research R6) |
| `conditionFromWmo(code)` | `WeatherCondition` |
| `temperatureUnit(locale: string)` | `'C' \| 'F'` |
| `formatTemp(tempC, unit)` | e.g. `"22°C"`, `"72°F"` |

## Platform ports (implemented by each app)

```ts
interface WeatherService {
  /** Rejects on network/provider failure. */
  forecast(location: Location): Promise<Forecast>;
  /** Up to 5 matches; empty array when nothing matches. Rejects on failure. */
  searchLocations(query: string, language: string): Promise<Location[]>;
}

interface KeyValueStore {
  get(key: string): string | null;   // never throws; null on any failure
  set(key: string, value: string): void;   // never throws
  remove(key: string): void;
}
```

`ForecastCache` (in core, built on `KeyValueStore` + `WeatherService`):

```ts
interface ForecastCache {
  /** Cached forecast if any (fresh or stale); never hits the network. */
  peek(location: Location): Forecast | null;
  /** Returns cached if fresher than 3 h, else fetches, stores, and returns. One in-flight request per key. */
  get(location: Location, now: Date): Promise<Forecast>;
}
function createForecastCache(service: WeatherService, store: KeyValueStore): ForecastCache;
```

Web adapters: `apps/web/src/adapters/openMeteoWeatherService.ts` (WeatherService),
`apps/web/src/adapters/localStorageStore.ts` (KeyValueStore).
