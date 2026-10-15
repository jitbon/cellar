import { useCallback, useEffect, useRef, useState } from 'react';
import type { Place, PlaceSuggestion } from '@cellar/core';
import { usePlaceSearch } from './services';

export type PlaceSuggestionStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface PlaceSuggestions {
  suggestions: PlaceSuggestion[];
  status: PlaceSuggestionStatus;
  /** Resolves a suggestion to a full Place and ends the search session. */
  pick(suggestion: PlaceSuggestion): Promise<Place>;
}

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

/**
 * Live place suggestions for a name field. Never blocks typing or saving: failures only set
 * `status: 'unavailable'`. `quiet` is a text that must not trigger a search (a name just taken
 * from a picked place).
 */
export function usePlaceSuggestions(
  text: string,
  near: { lat: number; lon: number } | null,
  { quiet = null }: { quiet?: string | null } = {},
): PlaceSuggestions {
  const search = usePlaceSearch();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [status, setStatus] = useState<PlaceSuggestionStatus>('idle');
  const token = useRef<string | null>(null);
  const latest = useRef(0);
  const lat = near?.lat;
  const lon = near?.lon;

  useEffect(() => {
    const input = text.trim();
    const request = ++latest.current;
    if (!search || input.length < MIN_CHARS || input === quiet) {
      setSuggestions([]);
      setStatus('idle');
      return;
    }
    const timer = setTimeout(() => {
      token.current ??= crypto.randomUUID();
      setStatus('loading');
      search
        .suggest(input, {
          sessionToken: token.current,
          near: lat === undefined || lon === undefined ? null : { lat, lon },
        })
        .then(
          (found) => {
            if (request !== latest.current) return;
            setSuggestions(found.slice(0, 5));
            setStatus('ready');
          },
          () => {
            if (request !== latest.current) return;
            setSuggestions([]);
            setStatus('unavailable');
          },
        );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, quiet, search, lat, lon]);

  const pick = useCallback(
    async (suggestion: PlaceSuggestion) => {
      if (!search) throw new Error('Place search unavailable');
      const place = await search.details(suggestion, token.current ?? crypto.randomUUID());
      token.current = null;
      return place;
    },
    [search],
  );

  return { suggestions, status, pick };
}
