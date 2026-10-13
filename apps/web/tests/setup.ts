import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// Newer Node versions ship an experimental global `localStorage` that shadows jsdom's and is
// unusable without flags; install a plain in-memory Storage so tests behave like a browser.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

let usable = false;
try {
  localStorage.setItem('__t', '1');
  localStorage.removeItem('__t');
  usable = true;
} catch {
  usable = false;
}
if (!usable) {
  const storage = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}
