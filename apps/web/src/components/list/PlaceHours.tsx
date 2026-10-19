import { useId, useState } from 'react';
import { openingHours, type HoursLine, type PlaceInfo } from '@cellar/core';
import styles from './PlaceDetail.module.css';

const locale = () => (typeof navigator === 'undefined' ? undefined : navigator.language);

/** "9:00 AM" in the viewer's locale; minutes since midnight, past-midnight values wrap. */
function clock(minutes: number): string {
  return new Intl.DateTimeFormat(locale(), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(1970, 0, 1, 0, minutes % 1440)));
}

/** "9:00 AM–9:00 PM, 6:00 PM–2:00 AM" */
function rangesText(line: HoursLine): string {
  return line.ranges.map((r) => `${clock(r.openMin)}–${clock(r.closeMin)}`).join(', ');
}

/** "Open today 9:00 AM–9:00 PM", "Closed today" or "Open 24 hours". */
function todayText(line: HoursLine): string {
  if (line.kind === 'open-24h') return 'Open 24 hours';
  if (line.kind === 'closed') return 'Closed today';
  return `Open today ${rangesText(line)}`;
}

function lineText(line: HoursLine): string {
  if (line.kind === 'open-24h') return 'Open 24 hours';
  if (line.kind === 'closed') return 'Closed';
  return rangesText(line);
}

/** Full weekday name for a provider weekday (Sunday = 0). */
function weekdayName(day: number): string {
  // 2024-01-07 was a Sunday.
  return new Date(Date.UTC(2024, 0, 7 + day)).toLocaleDateString(locale(), {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

/** Today's hours in the place's own time, with the whole week behind a disclosure button. */
export function PlaceHours({ info }: { info: PlaceInfo }) {
  const [now] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const listId = useId();
  const hours = openingHours(info, now);
  if (!hours) return null;

  return (
    <div className={styles.hours}>
      <p className={styles.hoursToday}>{todayText(hours.today)}</p>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Show week
      </button>
      {open ? (
        <ul id={listId} className={styles.week} aria-label="Opening hours">
          {hours.week.map((line) => (
            <li key={line.day} className={styles.weekLine}>
              <span className={styles.weekDay}>
                {weekdayName(line.day)}
                {line === hours.today ? <span className={styles.todayMark}>Today</span> : null}
              </span>
              <span>{lineText(line)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
