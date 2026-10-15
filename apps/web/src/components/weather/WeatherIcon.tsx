import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { formatTemp, temperatureUnit, type CellWeather, type WeatherCondition } from '@cellar/core';
import { Popover } from '../ui/Popover';
import styles from './WeatherIcon.module.css';

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  rain: 'Rain',
  snow: 'Snow',
  thunderstorm: 'Thunderstorm',
};

const CLOUD = 'M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 0 9.5z';
const SUN_RAYS =
  'M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4';

const GLYPHS: Record<WeatherCondition, ReactNode> = {
  clear: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d={SUN_RAYS} />
    </>
  ),
  'partly-cloudy': (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 2v1M2 8h1M3.8 3.8l.7.7M12.2 3.8l-.7.7" />
      <path d="M9 20a3.5 3.5 0 0 1-.4-6.98A4.75 4.75 0 0 1 17.5 12a4 4 0 0 1 0 8z" />
    </>
  ),
  cloudy: <path d={CLOUD} />,
  fog: <path d="M4 8h16M2 12h16M6 16h16M4 20h12" />,
  rain: (
    <>
      <path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4.5a4.75 4.75 0 0 1 0 9.5z" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
    </>
  ),
  snow: (
    <>
      <path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4.5a4.75 4.75 0 0 1 0 9.5z" />
      <path d="M8 17v3M6.5 18.5h3M12 17v3M10.5 18.5h3M16 17v3M14.5 18.5h3" />
    </>
  ),
  thunderstorm: (
    <>
      <path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4.5a4.75 4.75 0 0 1 0 9.5z" />
      <path d="M12.5 13l-3 4h4l-2 4" />
    </>
  ),
};

export function weatherLabel(blockName: string, weather: CellWeather): string {
  const rain = weather.rainPct === null ? '' : `, ${weather.rainPct}% chance of rain`;
  return `${blockName} weather: ${CONDITION_LABEL[weather.condition]}${rain}`;
}

interface Props {
  blockName: string;
  weather: CellWeather;
}

const HOVER_DELAY_MS = 150;

function forecastTime(fetchedAt: string): string {
  return new Date(fetchedAt).toLocaleTimeString(navigator.language, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Corner icon for a cell; its details open on hover, keyboard focus, or tap. */
export function WeatherIcon({ blockName, weather }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPointer = useRef('');
  const popoverId = useId();
  const close = useCallback(() => setOpen(false), []);
  const clearTimer = () => clearTimeout(hoverTimer.current);
  useEffect(() => clearTimer, []);

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
        className={styles.icon}
        aria-label={weatherLabel(blockName, weather)}
        aria-describedby={open ? popoverId : undefined}
        // The icon must never start a drag or take focus away from typing in the cell.
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
          e.stopPropagation();
        }}
        onClick={() => {
          if (lastPointer.current === 'touch') setOpen((o) => !o);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          data-condition={weather.condition}
        >
          {GLYPHS[weather.condition]}
        </svg>
      </button>
      {open ? (
        <Popover id={popoverId} anchorRef={wrapRef} onClose={close}>
          <strong>{CONDITION_LABEL[weather.condition]}</strong>
          <span>{formatTemp(weather.tempC, temperatureUnit(navigator.language))}</span>
          <span>
            {weather.rainPct === null
              ? 'Chance of rain unavailable'
              : `${weather.rainPct}% chance of rain`}
          </span>
          <span className={styles.meta}>Forecast as of {forecastTime(weather.fetchedAt)}</span>
          <a
            className={styles.meta}
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
          >
            Weather data by Open-Meteo.com
          </a>
        </Popover>
      ) : null}
    </span>
  );
}
