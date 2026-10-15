import type { KeyValueStore } from '@cellar/core';

/** localStorage can be missing or throw (private windows, blocked site data); never propagate. */
export class LocalStorageStore implements KeyValueStore {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore: the cache is a convenience
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
