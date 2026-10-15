import { ChevronLeft, ChevronRight, Icon } from './Icon';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { daysBetween, formatISODate, parseISODate, type ISODate } from '@cellar/core';
import { TextField } from './TextField';
import styles from './DateRangePicker.module.css';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const monthLabel = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayLabel = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' });
const shortLabel = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const addDays = (date: ISODate, n: number) => formatISODate(parseISODate(date) + n * DAY_MS);
const monthStart = (date: ISODate) => `${date.slice(0, 7)}-01`;

function addMonths(first: ISODate, n: number): ISODate {
  const d = new Date(parseISODate(first));
  return formatISODate(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** Short "Apr 1 – Apr 3 · 3 days" summary of a range. */
export function formatRange(start: ISODate, end: ISODate): string {
  const count = daysBetween(start, end) + 1;
  return `${shortLabel.format(parseISODate(start))} – ${shortLabel.format(parseISODate(end))} · ${count} day${count === 1 ? '' : 's'}`;
}

function Month({
  first,
  start,
  end,
  hover,
  focus,
  onPick,
  onHover,
  onKeyDown,
}: {
  first: ISODate;
  start: string;
  end: string;
  hover: ISODate | null;
  focus: ISODate;
  onPick: (date: ISODate) => void;
  onHover: (date: ISODate | null) => void;
  onKeyDown: (e: KeyboardEvent, date: ISODate) => void;
}) {
  const leading = new Date(parseISODate(first)).getUTCDay();
  const length = daysBetween(first, addMonths(first, 1));
  const dates = Array.from({ length }, (_, i) => addDays(first, i));
  // While choosing the end date, preview the range up to the hovered day.
  const rangeEnd = isDate(end) ? end : isDate(start) && hover && hover > start ? hover : null;
  const label = monthLabel.format(parseISODate(first));

  return (
    <div className={styles.month} role="group" aria-label={label}>
      <div className={styles.monthTitle}>{label}</div>
      <div className={styles.days} onMouseLeave={() => onHover(null)}>
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.weekday} aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {dates.map((date) => {
          const isStart = date === start;
          const isEnd = date === end;
          const inRange = !!rangeEnd && date > start && date < rangeEnd;
          const className = [
            styles.day,
            isStart || isEnd ? styles.selected : '',
            inRange ? styles.inRange : '',
            rangeEnd && isStart ? styles.rangeStart : '',
            date === rangeEnd ? styles.rangeEnd : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              className={className}
              aria-label={dayLabel.format(parseISODate(date))}
              aria-pressed={isStart || isEnd}
              tabIndex={date === focus ? 0 : -1}
              onClick={() => onPick(date)}
              onMouseEnter={() => onHover(date)}
              onKeyDown={(e) => onKeyDown(e, date)}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  error?: string | null;
}

/** Booking-style range picker: typed start/end fields plus a two-month calendar. */
export function DateRangePicker({ start, end, onChange, error }: Props) {
  const today = formatISODate(Date.now());
  const anchor = isDate(start) ? start : today;
  const [first, setFirst] = useState(monthStart(anchor));
  const [focus, setFocus] = useState<ISODate>(anchor);
  const [hover, setHover] = useState<ISODate | null>(null);
  const moved = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  // Keep the calendar showing the typed start date.
  useEffect(() => {
    if (!isDate(start)) return;
    const month = monthStart(start);
    setFirst((current) => (month < current || month > addMonths(current, 1) ? month : current));
  }, [start]);

  // Move DOM focus after arrow-key navigation re-renders the calendar.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    root.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus();
  }, [focus, first]);

  function pick(date: ISODate) {
    setFocus(date);
    if (!isDate(start) || isDate(end) || date < start) onChange(date, '');
    else onChange(start, date);
  }

  function onKeyDown(e: KeyboardEvent, date: ISODate) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = addDays(date, step);
    if (next < first) setFirst(addMonths(first, -1));
    else if (next >= addMonths(first, 2)) setFirst(addMonths(first, 1));
    moved.current = true;
    setFocus(next);
  }

  const months = [first, addMonths(first, 1)];
  const hint = !isDate(start)
    ? 'Pick your first day'
    : !isDate(end)
      ? 'Now pick your last day'
      : formatRange(start, end);

  return (
    <div className={styles.picker} ref={root}>
      <div className={styles.fields}>
        <TextField
          label="Start date"
          type="date"
          value={start}
          onChange={(e) => onChange(e.target.value, end)}
          required
        />
        <TextField
          label="End date"
          type="date"
          value={end}
          min={isDate(start) ? start : undefined}
          onChange={(e) => onChange(start, e.target.value)}
          required
          error={error}
        />
      </div>
      <div className={styles.calendar}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navButton}
            aria-label="Previous month"
            onClick={() => setFirst(addMonths(first, -1))}
          >
            <Icon as={ChevronLeft} />
          </button>
          <span className={styles.hint} aria-live="polite">
            {hint}
          </span>
          <button
            type="button"
            className={styles.navButton}
            aria-label="Next month"
            onClick={() => setFirst(addMonths(first, 1))}
          >
            <Icon as={ChevronRight} />
          </button>
        </div>
        <div className={styles.months}>
          {months.map((m) => (
            <Month
              key={m}
              first={m}
              start={start}
              end={end}
              hover={hover}
              focus={focus >= months[0] && focus < addMonths(first, 2) ? focus : months[0]}
              onPick={pick}
              onHover={setHover}
              onKeyDown={onKeyDown}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
