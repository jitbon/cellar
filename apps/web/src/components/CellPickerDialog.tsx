import { useState, type FormEvent } from 'react';
import { days, isGreyed, orderedBlocks, type ISODate, type TripState } from '@cellar/core';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import styles from './CellPickerDialog.module.css';

interface Props {
  title: string;
  confirmLabel: string;
  state: TripState;
  onPick: (date: ISODate, blockId: string) => void;
  onClose: () => void;
}

/** A non-drag way to choose a destination cell (WCAG 2.5.7 dragging alternative). */
export function CellPickerDialog({ title, confirmLabel, state, onPick, onClose }: Props) {
  const allDays = days(state.trip);
  const blocks = orderedBlocks(state);
  // Blocks outside a day's travel window take nothing new, so they cannot be picked.
  const firstOpen = (day: ISODate) => blocks.find((b) => !isGreyed(state, day, b.id))?.id ?? '';
  const [date, setDate] = useState(allDays[0].date);
  const [blockId, setBlockId] = useState(() => firstOpen(allDays[0].date));

  function chooseDate(next: ISODate) {
    setDate(next);
    if (!blockId || isGreyed(state, next, blockId)) setBlockId(firstOpen(next));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (blockId) onPick(date, blockId);
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          Day
          <select
            className={styles.select}
            value={date}
            onChange={(e) => chooseDate(e.target.value)}
          >
            {allDays.map((d) => (
              <option key={d.date} value={d.date}>
                {d.weekday} {d.date}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Time block
          <select
            className={styles.select}
            value={blockId}
            onChange={(e) => setBlockId(e.target.value)}
          >
            {blocks.map((b) => {
              const outside = isGreyed(state, date, b.id);
              return (
                <option key={b.id} value={b.id} disabled={outside}>
                  {outside ? `${b.name} (outside travel window)` : b.name}
                </option>
              );
            })}
          </select>
        </label>
        <div className={styles.actions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!blockId}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
