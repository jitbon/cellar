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
import type { Dispatch } from '../components/grid/PlacementChip';
import { ItemPanel } from '../components/list/ItemPanel';
import { SaveStatusBanner } from '../components/SaveStatusBanner';
import { LocationDialog } from '../components/weather/LocationDialog';
import { Banner } from '../components/ui/Banner';
import { TripHeader } from '../components/layout/TripHeader';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DateRangePicker, formatRange } from '../components/ui/DateRangePicker';
import { Dialog } from '../components/ui/Dialog';
import { TextField } from '../components/ui/TextField';
import { Toast, useTip } from '../components/ui/Toast';
import { useServices } from '../state/services';
import { useForecasts } from '../state/useForecasts';
import { useTrip } from '../state/useTrip';
import styles from './TripPlanner.module.css';

const PANEL_KEY = 'cellar:itemPanelOpen';

/** Stored per device; defaults to open on wide screens (data-model.md). */
function readPanelOpen(): boolean {
  try {
    const stored = localStorage.getItem(PANEL_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return window.innerWidth >= 1280;
}

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
  const createdTip = useTip('trip-created');
  const [panelOpen, setPanelOpen] = useState(readPanelOpen);
  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    try {
      localStorage.setItem(PANEL_KEY, open ? '1' : '0');
    } catch {
      // Not persisted; the choice still applies for this visit.
    }
  };
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

  useEffect(() => {
    if (!panelOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && window.matchMedia('(max-width: 639px)').matches) {
        setPanelOpen(false);
        try {
          localStorage.setItem(PANEL_KEY, '0');
        } catch {
          // Not persisted.
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [panelOpen]);

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
      <TripHeader
        name={state.trip.name}
        rangeLabel={formatRange(state.trip.startDate, state.trip.endDate)}
        locationName={tripPlace ? tripPlace.name : null}
        canUndo={trip.canUndo}
        canRedo={trip.canRedo}
        onUndo={trip.undo}
        onRedo={trip.redo}
        onEditDates={() => setSettingsOpen(true)}
        onEditLocation={() => setLocationOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        panel={{ open: panelOpen, onToggle: () => togglePanel(!panelOpen) }}
      />
      <div className={styles.strips}>
        <SaveStatusBanner outbox={outbox} />
        {tripPlace ? null : <Banner>Add a location to see the weather.</Banner>}
        {forecasts.unavailable ? <Banner tone="warning">Weather unavailable</Banner> : null}
      </div>
      {justCreated && createdTip.visible ? (
        <Toast
          onDismiss={() => {
            createdTip.dismiss();
            navigate(location.pathname, { replace: true });
          }}
        >
          Trip created for {formatRange(state.trip.startDate, state.trip.endDate)}. Plans change —
          click the dates up top anytime to move them.
        </Toast>
      ) : null}
      <DndProvider state={state} dispatch={dispatch}>
        <div className={styles.body}>
          <div className={styles.grid}>
            <Grid state={state} dispatch={dispatch} forecasts={forecasts} />
          </div>
          {panelOpen ? (
            <>
              <button
                type="button"
                className={styles.scrim}
                aria-label="Close list"
                tabIndex={-1}
                onClick={() => togglePanel(false)}
              />
              <div className={styles.panelSlot}>
                <div className={styles.handle} aria-hidden="true" />
                <ItemPanel state={state} dispatch={dispatch} />
              </div>
            </>
          ) : null}
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
