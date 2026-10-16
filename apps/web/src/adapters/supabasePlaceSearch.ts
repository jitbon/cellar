import {
  isFoodPlace,
  type Location,
  type Place,
  type PlaceSearch,
  type PlaceSuggestion,
  type PopularList,
  type PopularPlace,
} from '@cellar/core';
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

  async popular(city: Location): Promise<PopularList> {
    const fetchGroup = async (group: 'todo' | 'food') =>
      (
        await this.call<{ places: PopularPlace[] }>({
          action: 'popular',
          city: city.name,
          near: { lat: city.lat, lon: city.lon },
          group,
        })
      ).places.map((p) => ({ ...p, photo: p.photo ?? null }));
    const [todo, food] = await Promise.all([fetchGroup('todo'), fetchGroup('food')]);
    // A place both searches returned is shown once: Food when it is a food place, else Things to do.
    const inTodo = new Set(todo.map((p) => p.placeId));
    const inFood = new Set(food.map((p) => p.placeId));
    const shared = (p: PopularPlace) => inTodo.has(p.placeId) && inFood.has(p.placeId);
    return {
      city,
      todo: todo.filter((p) => !shared(p) || !isFoodPlace(p.types)),
      food: food.filter((p) => !shared(p) || isFoodPlace(p.types)),
      fetchedAt: new Date().toISOString(),
    };
  }

  async photoUrl(photoName: string, maxWidthPx: number): Promise<string> {
    const data = await this.call<{ photoUri: string }>({
      action: 'photo',
      name: photoName,
      maxWidthPx,
    });
    return data.photoUri;
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
