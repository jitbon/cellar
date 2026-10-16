# Contract: Core and web hook

## Core (`packages/core/src/weather/daySummary.ts`)

```ts
export interface DaySummary {
  phrase: string;
  highC: number;
  lowC: number;
  rainPct: number | null;
  fetchedAt: string;
}

/** The daytime (07:00–21:00) summary of a forecast for one date, or null if too few hours. */
export function summarizeDay(forecast: Forecast, date: ISODate): DaySummary | null;
```

Pure; rules in [research.md](../research.md) R2–R3. Exported from `packages/core/src/index.ts`.

## Web (`apps/web/src/state/useForecasts.ts`)

`Forecasts` gains:

```ts
/** The day's summary when the day is in the forecast range, else null. */
daySummary(date: ISODate): DaySummary | null;
```

Same resolution as `cellWeather` (day location, in-range status); no new requests.
