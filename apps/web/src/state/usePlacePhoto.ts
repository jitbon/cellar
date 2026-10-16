import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PlacePhotoRef, PlaceSearch } from '@cellar/core';
import { usePlaceSearch } from './services';

export interface PlacePhoto {
  /** Attach to the element whose visibility triggers the request. */
  ref: (el: Element | null) => void;
  url: string | null;
  /** `idle`: not in view yet; `none`: no photo, or it could not be loaded. */
  status: 'idle' | 'loading' | 'ready' | 'none';
}

// Google's terms don't allow storing photo names or URLs, so they live in memory for the session
// only. Keyed per place search so a swapped service (tests, sign-out) never sees another's.
interface Session {
  urls: Map<string, string>;
  failed: Set<string>;
  pending: Map<string, Promise<string>>;
}
const sessions = new WeakMap<PlaceSearch, Session>();
const sessionOf = (search: PlaceSearch): Session => {
  let s = sessions.get(search);
  if (!s) sessions.set(search, (s = { urls: new Map(), failed: new Set(), pending: new Map() }));
  return s;
};

// Lets the Popular footer list the authors of the photos that have loaded.
let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const changed = () => {
  version++;
  listeners.forEach((l) => l());
};

const keyOf = (name: string, width: number) => `${name}@${width}`;

function load(search: PlaceSearch, name: string, width: number): Promise<string> {
  const s = sessionOf(search);
  const key = keyOf(name, width);
  let request = s.pending.get(key);
  if (!request) {
    request = search.photoUrl(name, width).then(
      (url) => {
        s.urls.set(key, url);
        s.pending.delete(key);
        changed();
        return url;
      },
      (error: unknown) => {
        s.failed.add(key);
        s.pending.delete(key);
        throw error;
      },
    );
    s.pending.set(key, request);
  }
  return request;
}

/**
 * A place photo that is requested only once its element scrolls into view (SC-003), then kept
 * in session memory by photo name. A missing or failed photo is simply `none`.
 */
export function usePlacePhoto(photo: PlacePhotoRef | null, maxWidthPx: number): PlacePhoto {
  const search = usePlaceSearch();
  const name = photo?.name ?? null;
  const key = name ? keyOf(name, maxWidthPx) : null;
  const session = search ? sessionOf(search) : null;
  const [seen, setSeen] = useState(false);
  const [, rerender] = useState(0);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (el: Element | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!el || !name) return;
      if (typeof IntersectionObserver === 'undefined') {
        setSeen(true);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setSeen(true);
            io.disconnect();
          }
        },
        { rootMargin: '100px' },
      );
      io.observe(el);
      observer.current = io;
    },
    [name],
  );

  const cached = key ? session?.urls.get(key) : undefined;
  const failed = key ? (session?.failed.has(key) ?? false) : false;

  useEffect(() => {
    if (!search || !name || !seen || cached || failed) return;
    let active = true;
    const done = () => active && rerender((n) => n + 1);
    load(search, name, maxWidthPx).then(done, done);
    return () => {
      active = false;
    };
  }, [search, name, maxWidthPx, seen, cached, failed]);

  if (!search || !key || failed) return { ref, url: null, status: 'none' };
  if (cached) return { ref, url: cached, status: 'ready' };
  return { ref, url: null, status: seen ? 'loading' : 'idle' };
}

/** The photos among `photos` that have loaded this session, for their credits. */
export function useLoadedPhotos(photos: PlacePhotoRef[], maxWidthPx: number): PlacePhotoRef[] {
  const search = usePlaceSearch();
  useSyncExternalStore(subscribe, () => version);
  const urls = search ? sessionOf(search).urls : null;
  return photos.filter((p) => urls?.has(keyOf(p.name, maxWidthPx)));
}
