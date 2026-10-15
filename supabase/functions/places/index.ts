import { handlePlaces } from './handler.ts';

// Comma-separated browser origins allowed to call this function (default: the Vite dev server).
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

Deno.serve((req) =>
  handlePlaces(req, { key: Deno.env.get('GOOGLE_PLACES_API_KEY'), allowedOrigins }, fetch),
);
