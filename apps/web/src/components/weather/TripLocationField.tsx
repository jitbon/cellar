import { useEffect, useRef, useState } from 'react';
import { placeQueryFromTitle, type Location, type WeatherService } from '@cellar/core';
import { Button } from '../ui/Button';
import { Icon, MapPin } from '../ui/Icon';
import { LocationPicker } from './LocationPicker';
import styles from './TripLocationField.module.css';

interface Props {
  title: string;
  service: WeatherService;
  value: Location | null;
  onChange: (location: Location | null) => void;
}

const DEBOUNCE_MS = 500;

/**
 * Optional trip location for the new-trip form. Proposes a match for the trip title
 * ("Use Kyoto, Japan") without ever choosing it on its own; any failure just hides the proposal.
 */
export function TripLocationField({ title, service, value, onChange }: Props) {
  const [suggestion, setSuggestion] = useState<Location | null>(null);
  const latest = useRef(0);
  const query = placeQueryFromTitle(title);

  useEffect(() => {
    const request = ++latest.current;
    setSuggestion(null);
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      service.searchLocations(query, navigator.language.split('-')[0]).then(
        (found) => {
          if (request === latest.current) setSuggestion(found[0] ?? null);
        },
        () => {},
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, service]);

  if (value) {
    return (
      <div className={styles.chosen}>
        <span className={styles.label}>Location</span>
        <span className={styles.value}>
          <Icon as={MapPin} size="small" />
          <span>{value.name}</span>
          <Button variant="ghost" aria-label="Change location" onClick={() => onChange(null)}>
            Change
          </Button>
        </span>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      {suggestion ? (
        <Button className={styles.suggestion} onClick={() => onChange(suggestion)}>
          <Icon as={MapPin} size="small" />
          Use {suggestion.name}
        </Button>
      ) : null}
      <LocationPicker service={service} onSelect={onChange} label="Location (optional)" />
    </div>
  );
}
