import { useState, type FormEvent } from 'react';
import {
  dayLocationOverride,
  orderedBlocks,
  setDayLocation,
  setDayWindow,
  type DayForecastStatus,
  type ISODate,
  type TripState,
} from '@cellar/core';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { LocationDialog } from '../weather/LocationDialog';
import type { Dispatch } from './PlacementCard';
import styles from './DayHeader.module.css';

interface Props {
  state: TripState;
  date: ISODate;
  weekday: string;
  dispatch: Dispatch;
  forecastStatus?: DayForecastStatus;
}

function TravelDialog({
  state,
  date,
  dispatch,
  onClose,
}: Omit<Props, 'weekday' | 'forecastStatus'> & { onClose: () => void }) {
  const blocks = orderedBlocks(state);
  const setting = state.daySettings.find((d) => d.date === date);
  const [arrival, setArrival] = useState(setting?.arrivalBlockId ?? '');
  const [departure, setDeparture] = useState(setting?.departureBlockId ?? '');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = dispatch(setDayWindow(date, arrival || null, departure || null));
    if (result.ok) onClose();
    else setError(result.error.message);
  }

  return (
    <Dialog title={`Travel on ${date}`} onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          Arrival block
          <select
            className={styles.select}
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
          >
            <option value="">Not set</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Departure block
          <select
            className={styles.select}
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          >
            <option value="">Not set</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button
            onClick={() => {
              setArrival('');
              setDeparture('');
            }}
          >
            Clear
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function DayHeader({ state, date, weekday, dispatch, forecastStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const place = dayLocationOverride(state, date);
  const setting = state.daySettings.find((d) => d.date === date);
  const nameOf = (id: string | null) => state.blocks.find((b) => b.id === id)?.name;
  const arrival = nameOf(setting?.arrivalBlockId ?? null);
  const departure = nameOf(setting?.departureBlockId ?? null);

  return (
    <div className={styles.header}>
      <strong>{weekday}</strong>
      <span className={styles.date}>{date}</span>
      {forecastStatus?.kind === 'pending' ? (
        <span className={styles.date}>Forecast from {forecastStatus.availableFrom}</span>
      ) : null}
      {place ? <span className={styles.badge}>📍 {place.name}</span> : null}
      {arrival ? <span className={styles.badge}>✈ Arrive · {arrival}</span> : null}
      {departure ? <span className={styles.badge}>✈ Depart · {departure}</span> : null}
      <button
        type="button"
        className={styles.menuButton}
        aria-label={`Set arrival and departure for ${date}`}
        onClick={() => setOpen(true)}
      >
        Travel…
      </button>
      <button
        type="button"
        className={styles.menuButton}
        aria-label={`Set location for ${date}`}
        onClick={() => setLocationOpen(true)}
      >
        Location…
      </button>
      {place ? (
        <button
          type="button"
          className={styles.menuButton}
          aria-label={`Use trip location on ${date}`}
          onClick={() => dispatch(setDayLocation(date, null))}
        >
          Use trip location
        </button>
      ) : null}
      {locationOpen ? (
        <LocationDialog
          title={`Location for ${date}`}
          current={place}
          onSelect={(chosen) => dispatch(setDayLocation(date, chosen))}
          onClose={() => setLocationOpen(false)}
        />
      ) : null}
      {open ? (
        <TravelDialog
          state={state}
          date={date}
          dispatch={dispatch}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
