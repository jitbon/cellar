import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createTrip, validateTripName, type Trip } from '@cellar/core';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { Dialog } from '../components/ui/Dialog';
import { TextField } from '../components/ui/TextField';
import { useAuthUser, useServices } from '../state/services';
import styles from './Trips.module.css';

const GRACE_DAYS = 30;
const UNDO_MS = 10_000;

export function daysRemaining(deletedAt: string, now = Date.now()): number {
  const elapsed = Math.floor((now - new Date(deletedAt).getTime()) / 86_400_000);
  return Math.max(GRACE_DAYS - elapsed, 0);
}

function CreateTripDialog({ onClose }: { onClose: () => void }) {
  const { repo } = useServices();
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const result = createTrip(user.id, name, start, end);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    try {
      await repo.save(result.changes);
      navigate(`/trips/${result.state.trip.id}`, { state: { justCreated: true } });
    } catch (err) {
      setError((err as Error).message || 'Could not create the trip.');
    }
  }

  return (
    <Dialog title="New trip" wide onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <DateRangePicker
          start={start}
          end={end}
          onChange={(from, to) => {
            setStart(from);
            setEnd(to);
          }}
          error={error}
        />
        <span className={styles.muted}>Not sure yet? You can change your dates anytime.</span>
        <div className={styles.actions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Create trip
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RenameDialog({
  trip,
  onClose,
  onSaved,
}: {
  trip: Trip;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { repo } = useServices();
  const [name, setName] = useState(trip.name);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateTripName(name);
    if (invalid) {
      setError(invalid.message);
      return;
    }
    try {
      await repo.save([{ table: 'trips', op: 'upsert', row: { ...trip, name: name.trim() } }]);
      onSaved();
    } catch (err) {
      setError((err as Error).message || 'Could not rename the trip.');
    }
  }

  return (
    <Dialog title="Rename trip" onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
  );
}

export function Trips() {
  const { repo } = useServices();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [deleted, setDeleted] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Trip | null>(null);
  const [undo, setUndo] = useState<Trip | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [active, gone] = await Promise.all([repo.listTrips(), repo.listDeletedTrips()]);
      setTrips(active);
      setDeleted(gone);
    } catch (err) {
      setError((err as Error).message || 'Could not load trips.');
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, [refresh]);

  async function onDelete(trip: Trip) {
    await repo.deleteTrip(trip.id);
    setUndo(trip);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
    await refresh();
  }

  async function onRestore(trip: Trip) {
    await repo.restoreTrip(trip.id);
    if (undo?.id === trip.id) setUndo(null);
    await refresh();
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Your trips</h1>
        <nav className={styles.nav}>
          <Link to="/settings">Settings</Link>
          <Button variant="primary" onClick={() => setCreating(true)}>
            New trip
          </Button>
        </nav>
      </header>

      {error ? <Banner tone="error">{error}</Banner> : null}
      {undo ? (
        <Banner>
          “{undo.name}” was deleted.{' '}
          <Button variant="ghost" onClick={() => void onRestore(undo)}>
            Undo
          </Button>
        </Banner>
      ) : null}

      {trips === null ? (
        <p aria-live="polite">Loading…</p>
      ) : trips.length === 0 ? (
        <p>No trips yet. Create one to start planning.</p>
      ) : (
        <ul className={styles.list}>
          {trips.map((trip) => (
            <li key={trip.id} className={styles.card}>
              <Link to={`/trips/${trip.id}`} className={styles.cardLink}>
                <strong>{trip.name}</strong>
                <span className={styles.muted}>
                  {trip.startDate} → {trip.endDate}
                </span>
              </Link>
              <div className={styles.actions}>
                <Button
                  variant="ghost"
                  aria-label={`Rename ${trip.name}`}
                  onClick={() => setRenaming(trip)}
                >
                  Rename
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Delete ${trip.name}`}
                  onClick={() => void onDelete(trip)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className={styles.deleted}>
        <summary>Recently deleted ({deleted.length})</summary>
        {deleted.length === 0 ? (
          <p className={styles.muted}>Nothing here.</p>
        ) : (
          <ul className={styles.list}>
            {deleted.map((trip) => (
              <li key={trip.id} className={styles.card}>
                <div className={styles.cardLink}>
                  <strong>{trip.name}</strong>
                  <span className={styles.muted}>
                    {daysRemaining(trip.deletedAt!)} days left to restore
                  </span>
                </div>
                <Button aria-label={`Restore ${trip.name}`} onClick={() => void onRestore(trip)}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </details>

      {creating ? <CreateTripDialog onClose={() => setCreating(false)} /> : null}
      {renaming ? (
        <RenameDialog
          trip={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            setRenaming(null);
            void refresh();
          }}
        />
      ) : null}
    </main>
  );
}
