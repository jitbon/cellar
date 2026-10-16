import { useCallback, useSyncExternalStore } from 'react';
import { useKeyValueStore } from './services';

export const BANNER_HIDDEN_KEY = 'cellar.banner.hidden';

// The trip menu and the banner are in different places of the page; this keeps them in step.
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Whether the city banner is hidden on this device (all trips), and how to change it. */
export function useBannerHidden(): { hidden: boolean; setHidden: (hidden: boolean) => void } {
  const store = useKeyValueStore();
  const hidden = useSyncExternalStore(subscribe, () => store?.get(BANNER_HIDDEN_KEY) === '1');
  const setHidden = useCallback(
    (next: boolean) => {
      if (!store) return;
      if (next) store.set(BANNER_HIDDEN_KEY, '1');
      else store.remove(BANNER_HIDDEN_KEY);
      listeners.forEach((l) => l());
    },
    [store],
  );
  return { hidden, setHidden };
}
