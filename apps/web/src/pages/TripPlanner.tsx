import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  renameTrip,
  setTripLocation,
  tripLocation,
  updateTripDates,
  type TripState,
} from '@cellar/core';
import { DndProvider } from '../components/grid/DndProvider';
import { Grid } from '../components/grid/Grid';
import type { Dispatch } from '../components/grid/PlacementCard';
import { ItemList } from '../components/list/ItemList';
import { SaveStatusBanner } from '../components/SaveStatusBanner';
import { LocationDialog } from '../components/weather/LocationDialog';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DateRangePicker, formatRange } from '../components/ui/DateRangePicker';
import { Dialog } from '../components/ui/Dialog';
import { TextField } from '../components/ui/TextField';
import { useServices } from '../state/services';
import { useForecasts } from '../state/useForecasts';
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
      <Dialog title="Trip settings" wide onClose={onClose}>
        <form className={styles.form} onSubmit={onSubmit}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <DateRangePicker
            start={start}
            end={end}
            onChange={(from, to) => {
              setStart(from);
              setEnd(to);
            }}
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
  const location = useLocation();
  const navigate = useNavigate();
  const trip = useTrip(tripId);
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated ?? false;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const ready = trip.status === 'ready' ? trip : null;
  const forecasts = useForecasts(ready?.state ?? null);
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
  const tripPlace = tripLocation(state);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/">‹ Trips</Link>
        <h1>{state.trip.name}</h1>
        <button
          type="button"
          className={styles.dates}
          aria-label={`Change trip dates (${formatRange(state.trip.startDate, state.trip.endDate)})`}
          onClick={() => setSettingsOpen(true)}
        >
          <span aria-hidden="true">📅</span>
          {formatRange(state.trip.startDate, state.trip.endDate)}
        </button>
        <button
          type="button"
          className={styles.dates}
          aria-label={tripPlace ? `Change trip location (${tripPlace.name})` : 'Add a location'}
          onClick={() => setLocationOpen(true)}
        >
          <span aria-hidden="true">📍</span>
          {tripPlace ? tripPlace.name : 'Add a location'}
        </button>
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
      {justCreated ? (
        <Banner>
          Trip created for {formatRange(state.trip.startDate, state.trip.endDate)}. Plans change —
          click the dates up top anytime to move them.{' '}
          <Button variant="ghost" onClick={() => navigate(location.pathname, { replace: true })}>
            Got it
          </Button>
        </Banner>
      ) : null}
      <SaveStatusBanner outbox={outbox} />
      {tripPlace ? null : <Banner>Add a location to see the weather.</Banner>}
      {forecasts.unavailable ? <Banner tone="warning">Weather unavailable</Banner> : null}
      <DndProvider state={state} dispatch={dispatch}>
        <div className={styles.body}>
          <div className={styles.grid}>
            <Grid state={state} dispatch={dispatch} forecasts={forecasts} />
          </div>
          <ItemList state={state} dispatch={dispatch} />
        </div>
      </DndProvider>
      {locationOpen ? (
        <LocationDialog
          title="Trip location"
          current={tripPlace}
          onSelect={(place) => dispatch(setTripLocation(place))}
          clearLabel={tripPlace ? 'Remove location' : undefined}
          onClear={() => dispatch(setTripLocation(null))}
          onClose={() => setLocationOpen(false)}
        />
      ) : null}
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
