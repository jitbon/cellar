import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Command, Result, TripState } from '@cellar/core';
import { TripNotFoundError } from '../adapters/supabaseTripRepository';
import { useServices } from './services';
import { TripStore } from './tripStore';

type Loaded =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'ready'; store: TripStore };

export type UseTrip =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      state: TripState;
      dispatch: (command: Command) => Result;
      undo: () => void;
      redo: () => void;
      canUndo: boolean;
      canRedo: boolean;
    };

export function useTrip(tripId: string | undefined): UseTrip {
  const { repo, outbox } = useServices();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    if (!tripId) {
      setLoaded({ status: 'notfound' });
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let offOutbox: (() => void) | null = null;
    setLoaded({ status: 'loading' });

    repo
      .loadTrip(tripId)
      .then((initial) => {
        if (cancelled) return;
        const store = new TripStore(initial, outbox);
        unsubscribe = repo.subscribe(tripId, (change) => store.receive(change));
        // A permanently rejected save was undone on the server's side: reload the truth.
        offOutbox = outbox.subscribe((e) => {
          if (e.type !== 'discarded') return;
          repo.loadTrip(tripId).then(
            (fresh) => !cancelled && store.replace(fresh),
            () => {},
          );
        });
        setLoaded({ status: 'ready', store });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof TripNotFoundError) setLoaded({ status: 'notfound' });
        else
          setLoaded({
            status: 'error',
            message: (err as Error).message || 'Could not load the trip.',
          });
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      offOutbox?.();
    };
  }, [tripId, repo, outbox]);

  const store = loaded.status === 'ready' ? loaded.store : null;
  const state = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getState : getNull,
  );
  const dispatch = useCallback((command: Command) => store!.dispatch(command), [store]);

  const undo = useCallback(() => void store!.undo(), [store]);
  const redo = useCallback(() => void store!.redo(), [store]);

  if (store && state) {
    return {
      status: 'ready',
      state,
      dispatch,
      undo,
      redo,
      canUndo: store.canUndo,
      canRedo: store.canRedo,
    };
  }
  return loaded.status === 'ready' ? { status: 'loading' } : loaded;
}

const noopSubscribe = () => () => {};
const getNull = () => null;
