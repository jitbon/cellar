// Relays place search to Google Places API (New) so the key stays server-side.
// Plain fetch/Request/Response only (no Deno APIs) so Vitest can run it; index.ts wires Deno.serve.

const GOOGLE = 'https://places.googleapis.com/v1';
const BIAS_RADIUS_M = 30_000;
const MAX_SUGGESTIONS = 5;
const POPULAR_RADIUS_M = 15_000;
const MAX_POPULAR = 20;
// rating and userRatingCount put the request in Google's Enterprise tier (see research R2).
const POPULAR_FIELDS =
  'places.id,places.displayName,places.shortFormattedAddress,places.location,places.types,places.primaryType,places.primaryTypeDisplayName,places.rating,places.userRatingCount';
const TIMEOUT_MS = 5000;

// CORS is limited to the configured app origins: the request Origin is echoed only when listed,
// otherwise the allow-origin header is omitted so browsers block the response.
const corsHeaders = (origin: string | null, allowed: string[]): Record<string, string> => ({
  ...(origin && allowed.includes(origin) ? { 'access-control-allow-origin': origin } : {}),
  vary: 'origin',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
});

type Cors = Record<string, string>;

const json = (cors: Cors, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });

interface Prediction {
  placePrediction?: {
    placeId?: string;
    types?: string[];
    structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
  };
}

interface Near {
  lat: number;
  lon: number;
}

const badRequest = (cors: Cors) => json(cors, { error: 'bad_request' }, 400);
const unavailable = (cors: Cors) => json(cors, { error: 'unavailable' }, 503);

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function parseNear(v: unknown): Near | null | undefined {
  if (v === undefined || v === null) return null;
  const n = v as Partial<Near>;
  if (typeof n.lat !== 'number' || typeof n.lon !== 'number') return undefined;
  if (Math.abs(n.lat) > 90 || Math.abs(n.lon) > 180) return undefined;
  return { lat: n.lat, lon: n.lon };
}

async function suggest(
  cors: Cors,
  body: Record<string, unknown>,
  key: string,
  fetchFn: typeof fetch,
): Promise<Response> {
  const input = body.input;
  const near = parseNear(body.near);
  if (!isString(input) || input.length < 3 || input.length > 100) return badRequest(cors);
  if (!isString(body.sessionToken) || near === undefined) return badRequest(cors);

  const request: Record<string, unknown> = { input, sessionToken: body.sessionToken };
  if (near) {
    request.locationBias = {
      circle: { center: { latitude: near.lat, longitude: near.lon }, radius: BIAS_RADIUS_M },
    };
  }
  const res = await fetchFn(`${GOOGLE}/places:autocomplete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return unavailable(cors);
  const data = (await res.json()) as { suggestions?: Prediction[] };
  const suggestions = (data.suggestions ?? [])
    .flatMap((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return [];
      return [
        {
          placeId: p.placeId,
          name: p.structuredFormat?.mainText?.text ?? '',
          address: p.structuredFormat?.secondaryText?.text ?? '',
          types: p.types ?? [],
        },
      ];
    })
    .slice(0, MAX_SUGGESTIONS);
  return json(cors, { suggestions });
}

async function details(
  cors: Cors,
  body: Record<string, unknown>,
  key: string,
  fetchFn: typeof fetch,
): Promise<Response> {
  const { placeId, sessionToken } = body;
  if (!isString(placeId) || !isString(sessionToken)) return badRequest(cors);

  const url = `${GOOGLE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetchFn(url, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,location,shortFormattedAddress' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return unavailable(cors);
  const data = (await res.json()) as {
    id?: string;
    location?: { latitude?: number; longitude?: number };
    shortFormattedAddress?: string;
  };
  const { latitude, longitude } = data.location ?? {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return unavailable(cors);
  return json(cors, {
    place: {
      id: data.id ?? placeId,
      lat: latitude,
      lon: longitude,
      address: data.shortFormattedAddress ?? '',
    },
  });
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
}

const POPULAR_QUERY = {
  todo: 'top tourist attractions in',
  food: 'best restaurants in',
} as const;

async function popular(
  cors: Cors,
  body: Record<string, unknown>,
  key: string,
  fetchFn: typeof fetch,
): Promise<Response> {
  const { city, group } = body;
  const near = parseNear(body.near);
  if (!isString(city) || city.length > 120 || !near) return badRequest(cors);
  if (group !== 'todo' && group !== 'food') return badRequest(cors);

  const res = await fetchFn(`${GOOGLE}/places:searchText`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': POPULAR_FIELDS,
    },
    body: JSON.stringify({
      textQuery: `${POPULAR_QUERY[group]} ${city}`,
      locationBias: {
        circle: {
          center: { latitude: near.lat, longitude: near.lon },
          radius: POPULAR_RADIUS_M,
        },
      },
      pageSize: MAX_POPULAR,
      rankPreference: 'RELEVANCE',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return unavailable(cors);
  const data = (await res.json()) as { places?: GooglePlace[] };
  const places = (data.places ?? [])
    .flatMap((p) => {
      const name = p.displayName?.text;
      const { latitude, longitude } = p.location ?? {};
      if (!p.id || !name || typeof latitude !== 'number' || typeof longitude !== 'number') {
        return [];
      }
      return [
        {
          placeId: p.id,
          name,
          kind: p.primaryTypeDisplayName?.text ?? '',
          address: p.shortFormattedAddress ?? '',
          lat: latitude,
          lon: longitude,
          types: p.types ?? [],
          rating: p.rating ?? null,
          ratingCount: p.userRatingCount ?? null,
        },
      ];
    })
    .slice(0, MAX_POPULAR);
  return json(cors, { places });
}

export async function handlePlaces(
  req: Request,
  env: { key?: string; allowedOrigins: string[] },
  fetchFn: typeof fetch,
): Promise<Response> {
  const cors = corsHeaders(req.headers.get('origin'), env.allowedOrigins);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return badRequest(cors);
    body = parsed as Record<string, unknown>;
  } catch {
    return badRequest(cors);
  }
  if (body.action !== 'suggest' && body.action !== 'details' && body.action !== 'popular') {
    return badRequest(cors);
  }
  if (!env.key) return unavailable(cors);

  try {
    if (body.action === 'suggest') return await suggest(cors, body, env.key, fetchFn);
    if (body.action === 'details') return await details(cors, body, env.key, fetchFn);
    return await popular(cors, body, env.key, fetchFn);
  } catch {
    return unavailable(cors);
  }
}
