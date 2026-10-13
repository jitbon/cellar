import { useState, type FormEvent } from 'react';
import { orderedBlocks, setDayWindow, type ISODate, type TripState } from '@cellar/core';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import type { Dispatch } from './PlacementCard';
import styles from './DayHeader.module.css';

interface Props {
  state: TripState;
  date: ISODate;
  weekday: string;
  dispatch: Dispatch;
}

function TravelDialog({
  state,
  date,
  dispatch,
  onClose,
}: Omit<Props, 'weekday'> & { onClose: () => void }) {
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

export function DayHeader({ state, date, weekday, dispatch }: Props) {
  const [open, setOpen] = useState(false);
  const setting = state.daySettings.find((d) => d.date === date);
  const nameOf = (id: string | null) => state.blocks.find((b) => b.id === id)?.name;
  const arrival = nameOf(setting?.arrivalBlockId ?? null);
  const departure = nameOf(setting?.departureBlockId ?? null);

  return (
    <div className={styles.header}>
      <strong>{weekday}</strong>
      <span className={styles.date}>{date}</span>
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
