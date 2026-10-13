import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { renameTrip, updateTripDates, type TripState } from '@cellar/core';
import { DndProvider } from '../components/grid/DndProvider';
import { Grid } from '../components/grid/Grid';
import type { Dispatch } from '../components/grid/PlacementCard';
import { ItemList } from '../components/list/ItemList';
import { SaveStatusBanner } from '../components/SaveStatusBanner';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import { TextField } from '../components/ui/TextField';
import { useServices } from '../state/services';
import { useTrip } from '../state/useTrip';
import styles from './TripPlanner.module.css';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function TripSettingsDialog({
  state,
  dispatch,
  onClose,
}: {
  state: TripState;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [name, setName] = useState(state.trip.name);
  const [start, setStart] = useState(state.trip.startDate);
  const [end, setEnd] = useState(state.trip.endDate);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);

  function apply() {
    if (name.trim() !== state.trip.name) {
      const renamed = dispatch(renameTrip(name));
      if (!renamed.ok) {
        setError(renamed.error.message);
        return false;
      }
    }
    if (start !== state.trip.startDate || end !== state.trip.endDate) {
      const result = dispatch(updateTripDates(start, end));
      if (!result.ok) {
        setError(result.error.message);
        return false;
      }
    }
    onClose();
    return true;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Preview the effect of shrinking before changing anything.
    const preview = updateTripDates(start, end)(state);
    if (!preview.ok) {
      setError(preview.error.message);
      return;
    }
    if ((preview.removedPlacementCount ?? 0) > 0) {
      setPendingRemoval(preview.removedPlacementCount ?? 0);
      return;
    }
    apply();
  }

  return (
    <>
      <Dialog title="Trip settings" onClose={onClose}>
        <form className={styles.form} onSubmit={onSubmit}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Start date"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <TextField
            label="End date"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            error={error}
          />
          <div className={styles.actions}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </form>
      </Dialog>
      {pendingRemoval !== null ? (
        <ConfirmDialog
          title="Remove days?"
          confirmLabel="Delete placements"
          danger
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            setPendingRemoval(null);
            apply();
          }}
        >
          {pendingRemoval} placement{pendingRemoval === 1 ? '' : 's'} on removed days will be
          deleted.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export function TripPlanner() {
  const { tripId } = useParams();
  const { outbox } = useServices();
  const trip = useTrip(tripId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ready = trip.status === 'ready' ? trip : null;
  const undo = ready?.undo;
  const redo = ready?.redo;

  useEffect(() => {
    if (!undo || !redo) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || isTyping(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo!();
      else undo!();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  if (trip.status === 'loading') return <p aria-live="polite">Loading…</p>;
  if (trip.status === 'notfound') {
    return (
      <main className={styles.page}>
        <h1>Trip not found</h1>
        <Link to="/">Back to your trips</Link>
      </main>
    );
  }
  if (trip.status === 'error') {
    return (
      <main className={styles.page}>
        <Banner tone="error">{trip.message}</Banner>
        <Link to="/">Back to your trips</Link>
      </main>
    );
  }

  const { state, dispatch } = trip;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/">‹ Trips</Link>
        <h1>{state.trip.name}</h1>
        <div className={styles.toolbar}>
          <Button onClick={trip.undo} disabled={!trip.canUndo} aria-label="Undo">
            ↶ Undo
          </Button>
          <Button onClick={trip.redo} disabled={!trip.canRedo} aria-label="Redo">
            ↷ Redo
          </Button>
          <Button onClick={() => setSettingsOpen(true)}>Trip settings</Button>
        </div>
      </header>
      <SaveStatusBanner outbox={outbox} />
      <DndProvider state={state} dispatch={dispatch}>
        <div className={styles.body}>
          <div className={styles.grid}>
            <Grid state={state} dispatch={dispatch} />
          </div>
          <ItemList state={state} dispatch={dispatch} />
        </div>
      </DndProvider>
      {settingsOpen ? (
        <TripSettingsDialog
          state={state}
          dispatch={dispatch}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </main>
  );
}
