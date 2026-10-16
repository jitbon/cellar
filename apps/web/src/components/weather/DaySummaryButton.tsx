import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { formatTemp, temperatureUnit, type DaySummary, type ISODate } from '@cellar/core';
import { Popover } from '../ui/Popover';
import styles from './DaySummaryButton.module.css';

const HOVER_DELAY_MS = 150;

function forecastTime(fetchedAt: string): string {
  return new Date(fetchedAt).toLocaleTimeString(navigator.language, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A day's weather in a few words (feature 009). Like the cell icons, its details (high/low,
 * rain chance, forecast time) open on hover, keyboard focus or tap.
 */
export function DaySummaryButton({ date, summary }: { date: ISODate; summary: DaySummary }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPointer = useRef('');
  const popoverId = useId();
  const close = useCallback(() => setOpen(false), []);
  const clearTimer = () => clearTimeout(hoverTimer.current);
  useEffect(() => clearTimer, []);
  const unit = temperatureUnit(navigator.language);

  return (
    <span
      ref={wrapRef}
      className={styles.wrap}
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch') return;
        clearTimer();
        hoverTimer.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'touch') return;
        clearTimer();
        setOpen(false);
      }}
      onFocus={() => {
        // A tap focuses the button too; its click toggles instead.
        if (lastPointer.current !== 'touch') setOpen(true);
      }}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.phrase}
        aria-label={`Weather for ${date}: ${summary.phrase}`}
        aria-describedby={open ? popoverId : undefined}
        title={summary.phrase}
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
        }}
        onClick={() => {
          if (lastPointer.current === 'touch') setOpen((o) => !o);
        }}
      >
        {summary.phrase}
      </button>
      {open ? (
        <Popover id={popoverId} anchorRef={wrapRef} onClose={close}>
          <strong>{summary.phrase}</strong>
          <span>
            High {formatTemp(summary.highC, unit)} · Low {formatTemp(summary.lowC, unit)}
          </span>
          {summary.rainPct === null ? null : <span>Rain up to {summary.rainPct}%</span>}
          <span className={styles.meta}>Forecast as of {forecastTime(summary.fetchedAt)}</span>
        </Popover>
      ) : null}
    </span>
  );
}
