// Relays place search to Google Places API (New) so the key stays server-side.
// Plain fetch/Request/Response only (no Deno APIs) so Vitest can run it; index.ts wires Deno.serve.

const GOOGLE = 'https://places.googleapis.com/v1';
const BIAS_RADIUS_M = 30_000;
const MAX_SUGGESTIONS = 5;
const TIMEOUT_MS = 5000;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

const badRequest = () => json({ error: 'bad_request' }, 400);
const unavailable = () => json({ error: 'unavailable' }, 503);

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

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function parseNear(v: unknown): Near | null | undefined {
  if (v === undefined || v === null) return null;
  const n = v as Partial<Near>;
  if (typeof n.lat !== 'number' || typeof n.lon !== 'number') return undefined;
  if (Math.abs(n.lat) > 90 || Math.abs(n.lon) > 180) return undefined;
  return { lat: n.lat, lon: n.lon };
}

async function suggest(
  body: Record<string, unknown>,
  key: string,
  fetchFn: typeof fetch,
): Promise<Response> {
  const input = body.input;
  const near = parseNear(body.near);
  if (!isString(input) || input.length < 3 || input.length > 100) return badRequest();
  if (!isString(body.sessionToken) || near === undefined) return badRequest();

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
  if (!res.ok) return unavailable();
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
  return json({ suggestions });
}

async function details(
  body: Record<string, unknown>,
  key: string,
  fetchFn: typeof fetch,
): Promise<Response> {
  const { placeId, sessionToken } = body;
  if (!isString(placeId) || !isString(sessionToken)) return badRequest();

  const url = `${GOOGLE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetchFn(url, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,location,shortFormattedAddress' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return unavailable();
  const data = (await res.json()) as {
    id?: string;
    location?: { latitude?: number; longitude?: number };
    shortFormattedAddress?: string;
  };
  const { latitude, longitude } = data.location ?? {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return unavailable();
  return json({
    place: {
      id: data.id ?? placeId,
      lat: latitude,
      lon: longitude,
      address: data.shortFormattedAddress ?? '',
    },
  });
}

export async function handlePlaces(
  req: Request,
  env: { key?: string },
  fetchFn: typeof fetch,
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return badRequest();
    body = parsed as Record<string, unknown>;
  } catch {
    return badRequest();
  }
  if (body.action !== 'suggest' && body.action !== 'details') return badRequest();
  if (!env.key) return unavailable();

  try {
    return body.action === 'suggest'
      ? await suggest(body, env.key, fetchFn)
      : await details(body, env.key, fetchFn);
  } catch {
    return unavailable();
  }
}
