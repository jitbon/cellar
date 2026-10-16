# Data Model: Day Weather Summary

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

No stored data. One derived value per in-range day.

## DaySummary (derived, not stored)

| Field | Type | Notes |
|---|---|---|
| `phrase` | string | ≤ 24 characters, rules in research R3 |
| `highC` | number | Max daytime temperature (°C, rounded) |
| `lowC` | number | Min daytime temperature (°C, rounded) |
| `rainPct` | number \| null | Highest daytime chance of rain |
| `fetchedAt` | string | From the forecast, for "Forecast as of HH:MM" |

`null` when fewer than 8 of the 15 daytime hours (07:00–21:00) are in the forecast.
