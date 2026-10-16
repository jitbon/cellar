# Quickstart: Day Weather Summary

Contract: [contracts/core.md](./contracts/core.md). Rules: [research.md](./research.md) R3.

## Automated checks

```sh
pnpm lint && pnpm --filter web typecheck
pnpm test                 # includes the phrase table test
pnpm --filter web e2e     # Open-Meteo mocked
```

## Manual scenarios

| # | Steps | Expected |
|---|---|---|
| 1 | Open a located trip starting this week | Each in-range day header shows a short phrase on line 2 (e.g. "Sunny, PM rain") |
| 2 | Hover / focus / tap a phrase | High and low, highest rain chance, "Forecast as of HH:MM" |
| 3 | Set an arrival on a day | "Arrive · Lunch" becomes a plane icon (tooltip) beside the phrase; header stays two lines |
| 4 | A day beyond 16 days | No phrase; "Forecast from …" unchanged |
| 5 | Trip without a location | No phrases; headers unchanged |
| 6 | Day with a different city | Phrase follows that city's forecast |
| 7 | 360 px, dark mode, keyboard | Phrase truncates with "…", full text on focus; axe clean |
