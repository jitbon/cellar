import { handlePlaces } from './handler.ts';

Deno.serve((req) => handlePlaces(req, { key: Deno.env.get('GOOGLE_PLACES_API_KEY') }, fetch));
