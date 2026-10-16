import { useState, type ComponentType, type FormEvent } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  dayLocationOverride,
  orderedBlocks,
  setDayLocation,
  setDayWindow,
  type DayForecastStatus,
  type DaySummary,
  type ISODate,
  type TripState,
} from '@cellar/core';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon, MapPin, MoreHorizontal, PlaneLanding, PlaneTakeoff } from '../ui/Icon';
import { Menu, MenuItem } from '../ui/Menu';
import { DaySummaryButton } from '../weather/DaySummaryButton';
import { LocationDialog } from '../weather/LocationDialog';
import type { Dispatch } from './PlacementChip';
import styles from './DayHeader.module.css';

interface Props {
  state: TripState;
  date: ISODate;
  weekday: string;
  dispatch: Dispatch;
  forecastStatus?: DayForecastStatus;
  /** Today's header gets a "Today" label (text, so it never relies on color alone). */
  isToday?: boolean;
  /** The day's weather phrase (feature 009); null outside the forecast range. */
  summary?: DaySummary | null;
}

function TravelDialog({
  state,
  date,
  dispatch,
  onClose,
}: Omit<Props, 'weekday' | 'forecastStatus' | 'isToday'> & { onClose: () => void }) {
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

function shortName(name: string): string {
  return name.split(',')[0]!.trim();
}

export function DayHeader({
  state,
  date,
  weekday,
  dispatch,
  forecastStatus,
  isToday,
  summary = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const place = dayLocationOverride(state, date);
  const setting = state.daySettings.find((d) => d.date === date);
  const nameOf = (id: string | null) => state.blocks.find((b) => b.id === id)?.name;
  const arrival = nameOf(setting?.arrivalBlockId ?? null);
  const departure = nameOf(setting?.departureBlockId ?? null);
  const shortDate = new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  // With a weather phrase on the second line, travel and city labels shrink to icons (with the
  // full text as their name and tooltip) so the header stays two lines (feature 009).
  const compact = summary !== null;
  const indicator = (icon: ComponentType<LucideProps>, text: string) => (
    <button
      type="button"
      className={styles.indicator}
      aria-label={`${text}. Open day options for ${date}`}
      title={compact ? text : undefined}
      onClick={() => setMenuOpen(true)}
    >
      <Icon as={icon} size="small" />
      {compact ? null : <span>{text}</span>}
    </button>
  );

  return (
    <div className={styles.header} data-testid="day-header">
      <div className={styles.line}>
        <span className={styles.weekday}>{weekday.slice(0, 3).toUpperCase()}</span>
        <span className={styles.date}>{shortDate}</span>
        {isToday ? <span className={styles.todayLabel}>Today</span> : null}
        <Menu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          trigger={
            <button
              type="button"
              className={styles.menuButton}
              aria-label={`Day options for ${date}`}
            >
              <Icon as={MoreHorizontal} />
            </button>
          }
        >
          {forecastStatus?.kind === 'pending' ? (
            <MenuItem disabled onSelect={() => {}}>
              Forecast from {forecastStatus.availableFrom}
            </MenuItem>
          ) : null}
          <MenuItem
            icon={PlaneLanding}
            aria-label={`Set arrival and departure for ${date}`}
            onSelect={() => setOpen(true)}
          >
            Arrival and departure
          </MenuItem>
          <MenuItem
            icon={MapPin}
            aria-label={`Set location for ${date}`}
            onSelect={() => setLocationOpen(true)}
          >
            Location
          </MenuItem>
          {place ? (
            <MenuItem
              aria-label={`Use trip location on ${date}`}
              onSelect={() => dispatch(setDayLocation(date, null))}
            >
              Use trip location
            </MenuItem>
          ) : null}
        </Menu>
      </div>
      {arrival || departure || place || summary ? (
        <div className={`${styles.indicators} ${compact ? styles.compact : ''}`}>
          {arrival ? indicator(PlaneLanding, `Arrive · ${arrival}`) : null}
          {departure ? indicator(PlaneTakeoff, `Depart · ${departure}`) : null}
          {place ? indicator(MapPin, shortName(place.name)) : null}
          {summary ? <DaySummaryButton date={date} summary={summary} /> : null}
        </div>
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
