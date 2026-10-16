import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  createTrip,
  setTripCoverPhoto,
  tripStatus,
  tripStatusLabel,
  tripToday,
  validateTripName,
  type Command,
  type Location,
  type Trip,
  type TripState,
} from '@cellar/core';
import { Banner } from '../components/ui/Banner';
import { CalendarDays, Icon, ImageOff, MapPin, MoreHorizontal, Plus } from '../components/ui/Icon';
import { Menu, MenuItem } from '../components/ui/Menu';
import { Button } from '../components/ui/Button';
import { DateRangePicker, formatRange } from '../components/ui/DateRangePicker';
import { Dialog } from '../components/ui/Dialog';
import { TextField } from '../components/ui/TextField';
import { CoverPhotoPicker } from '../components/photos/CoverPhotoPicker';
import { PhotoCredit } from '../components/photos/PhotoCredit';
import { TripLocationField } from '../components/weather/TripLocationField';
import { useAuthUser, useServices } from '../state/services';
import { useCityPhoto } from '../state/useCityPhoto';
import styles from './Trips.module.css';

const GRACE_DAYS = 30;
const UNDO_MS = 10_000;

export function daysRemaining(deletedAt: string, now = Date.now()): number {
  const elapsed = Math.floor((now - new Date(deletedAt).getTime()) / 86_400_000);
  return Math.max(GRACE_DAYS - elapsed, 0);
}

function CreateTripDialog({ onClose }: { onClose: () => void }) {
  const { repo, weather } = useServices();
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const result = createTrip(user.id, name, start, end, location);
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
        <TripLocationField title={name} service={weather} value={location} onChange={setLocation} />
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

interface CardProps {
  trip: Trip;
  now: Date;
  onRename: () => void;
  onDelete: () => void;
  /** A file name, or null for the automatic photo. */
  onPickCover: (file: string | null) => void;
}

/** A trip as a card: city photo (or placeholder) with a status pill, details, credit, menu. */
function TripCard({ trip, now, onRename, onDelete, onPickCover }: CardProps) {
  const { photo, status } = useCityPhoto(trip.locationName, trip.coverPhoto);
  const [picking, setPicking] = useState(false);
  const label = tripStatusLabel(tripStatus(trip, tripToday({ trip }, now)));
  const located = trip.locationName !== null;

  return (
    <li className={styles.card}>
      <Link to={`/trips/${trip.id}`} className={styles.cardLink}>
        <span className={styles.cover}>
          {photo ? (
            <img className={styles.coverImage} src={photo.url} alt={trip.locationName ?? ''} />
          ) : status === 'loading' ? null : (
            <span className={styles.placeholder}>
              <Icon as={located ? ImageOff : MapPin} />
              {located ? null : <span>Set a location to get a cover photo</span>}
            </span>
          )}
          <span className={styles.pill}>{label}</span>
        </span>
        <span className={styles.details}>
          <span className={styles.rowName}>{trip.name}</span>
          <span className={styles.rowMeta}>
            <Icon as={CalendarDays} />
            {formatRange(trip.startDate, trip.endDate)}
          </span>
          {trip.locationName ? (
            <span className={styles.rowMeta}>
              <Icon as={MapPin} />
              {trip.locationName}
            </span>
          ) : null}
        </span>
      </Link>
      <div className={styles.cardFooter}>
        {photo ? (
          <PhotoCredit credit={photo.credit} license={photo.license} href={photo.sourceUrl} />
        ) : (
          <span />
        )}
        <Menu
          trigger={
            <button
              type="button"
              className={styles.cardMenu}
              aria-label={`Actions for ${trip.name}`}
            >
              <Icon as={MoreHorizontal} />
            </button>
          }
        >
          <MenuItem aria-label={`Rename ${trip.name}`} onSelect={onRename}>
            Rename
          </MenuItem>
          {located ? (
            <MenuItem onSelect={() => setPicking(true)}>Change cover photo</MenuItem>
          ) : null}
          <MenuItem danger aria-label={`Delete ${trip.name}`} onSelect={onDelete}>
            Delete
          </MenuItem>
        </Menu>
      </div>
      {picking && trip.locationName ? (
        <CoverPhotoPicker
          cityName={trip.locationName}
          current={trip.coverPhoto ?? photo?.file ?? null}
          onPick={onPickCover}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </li>
  );
}

/** A trip alone as a TripState, so core commands can run on it from the trips list. */
const tripOnly = (trip: Trip): TripState => ({
  trip,
  blocks: [],
  daySettings: [],
  items: [],
  placements: [],
});

export function Trips() {
  const { repo } = useServices();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [deleted, setDeleted] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Trip | null>(null);
  const [undo, setUndo] = useState<Trip | null>(null);
  const now = new Date();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coverUndo, setCoverUndo] = useState<{
    name: string;
    revert: Command;
    state: TripState;
  } | null>(null);
  const coverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (coverTimer.current) clearTimeout(coverTimer.current);
    };
  }, [refresh]);

  function replaceTrip(next: Trip) {
    setTrips((all) => all && all.map((t) => (t.id === next.id ? next : t)));
  }

  async function onPickCover(trip: Trip, file: string | null) {
    const result = setTripCoverPhoto(file)(tripOnly(trip));
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    try {
      await repo.save(result.changes);
    } catch (err) {
      setError((err as Error).message || 'Could not change the cover photo.');
      return;
    }
    replaceTrip(result.state.trip);
    setCoverUndo({ name: trip.name, revert: result.inverse, state: result.state });
    if (coverTimer.current) clearTimeout(coverTimer.current);
    coverTimer.current = setTimeout(() => setCoverUndo(null), UNDO_MS);
  }

  async function onUndoCover() {
    if (!coverUndo) return;
    const result = coverUndo.revert(coverUndo.state);
    setCoverUndo(null);
    if (!result.ok) return;
    try {
      await repo.save(result.changes);
      replaceTrip(result.state.trip);
    } catch (err) {
      setError((err as Error).message || 'Could not undo the cover photo change.');
    }
  }

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
    <>
      <header className={styles.bar}>
        <h1 className={styles.barTitle}>Your trips</h1>
        <nav className={styles.nav}>
          <Link to="/settings" className={styles.barLink}>
            Settings
          </Link>
          <Button className={styles.newTrip} onClick={() => setCreating(true)}>
            <Icon as={Plus} />
            New trip
          </Button>
        </nav>
      </header>
      <main className={styles.page}>
        {error ? <Banner tone="error">{error}</Banner> : null}
        {undo ? (
          <Banner>
            “{undo.name}” was deleted.{' '}
            <Button variant="ghost" onClick={() => void onRestore(undo)}>
              Undo
            </Button>
          </Banner>
        ) : null}

        {coverUndo ? (
          <Banner>
            Cover photo changed for “{coverUndo.name}”.{' '}
            <Button variant="ghost" onClick={() => void onUndoCover()}>
              Undo
            </Button>
          </Banner>
        ) : null}

        {trips === null ? (
          <p aria-live="polite">Loading…</p>
        ) : trips.length === 0 ? (
          <p>No trips yet. Create one to start planning.</p>
        ) : (
          <ul className={styles.cards}>
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                now={now}
                onRename={() => setRenaming(trip)}
                onDelete={() => void onDelete(trip)}
                onPickCover={(file) => void onPickCover(trip, file)}
              />
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
                <li key={trip.id} className={styles.row}>
                  <div className={styles.rowLink}>
                    <span className={styles.rowName}>{trip.name}</span>
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
    </>
  );
}
