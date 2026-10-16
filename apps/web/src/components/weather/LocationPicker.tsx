import { useEffect, useId, useRef, useState } from 'react';
import type { Location, WeatherService } from '@cellar/core';
import styles from './LocationPicker.module.css';

interface Props {
  service: WeatherService;
  onSelect: (location: Location) => void;
  label?: string;
  autoFocus?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

type Status = 'idle' | 'ok' | 'empty' | 'error';

/** Search-as-you-type place picker (WAI-ARIA combobox with a listbox popup). */
export function LocationPicker({
  service,
  onSelect,
  label = 'Search for a place',
  autoFocus = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const latest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    const request = ++latest.current;
    if (text.length < MIN_CHARS) {
      setStatus('idle');
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      service.searchLocations(text, navigator.language.split('-')[0]).then(
        (found) => {
          if (request !== latest.current) return;
          setResults(found.slice(0, 5));
          setStatus(found.length === 0 ? 'empty' : 'ok');
          setActiveIndex(-1);
          setOpen(true);
        },
        () => {
          if (request !== latest.current) return;
          setResults([]);
          setStatus('error');
        },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, service]);

  const showList = open && status === 'ok';
  const optionId = (i: number) => `${listId}-${i}`;

  function choose(location: Location) {
    setOpen(false);
    onSelect(location);
  }

  return (
    <div className={styles.picker}>
      <label className={styles.label} htmlFor={`${listId}-input`}>
        {label}
      </label>
      <input
        id={`${listId}-input`}
        className={styles.input}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && showList) {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp' && showList) {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (showList && results[activeIndex]) choose(results[activeIndex]);
          } else if (e.key === 'Escape' && showList) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <ul id={listId} role="listbox" aria-label="Matching places" className={styles.list}>
          {results.map((place, i) => (
            <li
              key={`${place.lat},${place.lon}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              className={`${styles.option} ${i === activeIndex ? styles.active : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(place)}
            >
              {place.name}
            </li>
          ))}
        </ul>
      ) : null}
      {status === 'empty' ? (
        <p role="status" className={styles.message}>
          No matching place found
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className={styles.error}>
          Couldn&apos;t search places right now
        </p>
      ) : null}
    </div>
  );
}
