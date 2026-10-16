import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { formatTemp, temperatureUnit, type CellWeather, type WeatherCondition } from '@cellar/core';
import { Popover } from '../ui/Popover';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Icon,
  Moon,
  Sun,
} from '../ui/Icon';
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

const GLYPHS: Record<WeatherCondition, ComponentType<LucideProps>> = {
  clear: Sun,
  'partly-cloudy': CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  thunderstorm: CloudLightning,
};

/** Night versions for the conditions that show the sun; the rest look the same after dark. */
const NIGHT_GLYPHS: Partial<Record<WeatherCondition, ComponentType<LucideProps>>> = {
  clear: Moon,
  'partly-cloudy': CloudMoon,
};

const isNightGlyph = (weather: CellWeather) =>
  weather.night && NIGHT_GLYPHS[weather.condition] !== undefined;

function conditionLabel(weather: CellWeather): string {
  const label = CONDITION_LABEL[weather.condition];
  return isNightGlyph(weather) ? `${label} night` : label;
}

export function weatherLabel(blockName: string, weather: CellWeather): string {
  const rain = weather.rainPct === null ? '' : `, ${weather.rainPct}% chance of rain`;
  return `${blockName} weather: ${conditionLabel(weather)}${rain}`;
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
        <Icon
          as={(weather.night && NIGHT_GLYPHS[weather.condition]) || GLYPHS[weather.condition]}
          size="small"
          data-condition={isNightGlyph(weather) ? 'night' : weather.condition}
        />
      </button>
      {open ? (
        <Popover id={popoverId} anchorRef={wrapRef} onClose={close}>
          <strong>{conditionLabel(weather)}</strong>
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
