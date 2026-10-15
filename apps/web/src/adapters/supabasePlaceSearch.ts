import type { Place, PlaceSearch, PlaceSuggestion } from '@cellar/core';
import type { SupabaseClient } from '@supabase/supabase-js';

interface DetailsBody {
  place: { id: string; lat: number; lon: number; address: string };
}

/** Place search through the `places` Edge Function, which holds the Google key. */
export class SupabasePlaceSearch implements PlaceSearch {
  constructor(private readonly client: SupabaseClient) {}

  private async call<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.functions.invoke('places', { body });
    if (error) throw error;
    return data as T;
  }

  async suggest(
    input: string,
    opts: { sessionToken: string; near: { lat: number; lon: number } | null },
  ): Promise<PlaceSuggestion[]> {
    const data = await this.call<{ suggestions: PlaceSuggestion[] }>({
      action: 'suggest',
      input,
      sessionToken: opts.sessionToken,
      near: opts.near,
    });
    return data.suggestions;
  }

  async details(suggestion: PlaceSuggestion, sessionToken: string): Promise<Place> {
    const { place } = await this.call<DetailsBody>({
      action: 'details',
      placeId: suggestion.placeId,
      sessionToken,
    });
    return {
      id: place.id,
      provider: 'google',
      name: suggestion.name,
      address: place.address,
      lat: place.lat,
      lon: place.lon,
      category: suggestion.types[0] ?? null,
    };
  }
}
