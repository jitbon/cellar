import { useEffect, useId, useState } from 'react';
import type { Place, PlaceSuggestion } from '@cellar/core';
import { usePlaceSuggestions } from '../../state/usePlaceSuggestions';
import { TextField } from '../ui/TextField';
import { PlaceLine } from './PlaceLine';
import { PlaceOptions, placeOptionId } from './PlaceOptions';
import styles from './PlaceNameField.module.css';

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** The place the form currently holds; typing a different name keeps it. */
  place: Place | null;
  /** Called with the picked place (and its suggestion, for the food check) after details load. */
  onPick: (place: Place, suggestion: PlaceSuggestion) => void;
  near: { lat: number; lon: number } | null;
  error?: string | null;
  autoFocus?: boolean;
}

/**
 * The name field of an item or event form: a combobox that suggests real places while typing.
 * Ignoring the list keeps the typed text as a plain name.
 */
export function PlaceNameField({ value, onChange, place, onPick, near, error, autoFocus }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pickFailed, setPickFailed] = useState(false);
  const search = usePlaceSuggestions(value, near, { quiet: place?.name ?? null });
  const { suggestions, pick } = search;
  const status = pickFailed ? 'unavailable' : search.status;
  const hasOptions = open && suggestions.length > 0;
  const showPanel =
    open && (suggestions.length > 0 || status === 'ready' || status === 'unavailable');

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  function choose(suggestion: PlaceSuggestion) {
    pick(suggestion).then(
      (picked) => {
        setPickFailed(false);
        setOpen(false);
        onChange(picked.name);
        onPick(picked, suggestion);
      },
      () => setPickFailed(true),
    );
  }

  return (
    <div className={styles.field}>
      <div className={styles.anchor}>
        <TextField
          label="Name"
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={hasOptions}
          aria-controls={hasOptions ? listId : undefined}
          aria-activedescendant={
            hasOptions && activeIndex >= 0 ? placeOptionId(listId, activeIndex) : undefined
          }
          aria-autocomplete="list"
          error={error}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setPickFailed(false);
          }}
          onBlur={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && hasOptions) {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp' && hasOptions) {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === 'Enter' && hasOptions && suggestions[activeIndex]) {
              e.preventDefault();
              choose(suggestions[activeIndex]);
            } else if (e.key === 'Escape' && showPanel) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
        {showPanel ? (
          <div className={styles.panel}>
            {hasOptions ? (
              <div id={listId} role="listbox" aria-label="Place suggestions">
                <PlaceOptions
                  id={listId}
                  suggestions={suggestions}
                  status={status}
                  activeIndex={activeIndex}
                  onChoose={choose}
                />
              </div>
            ) : (
              <PlaceOptions
                id={listId}
                suggestions={[]}
                status={status}
                activeIndex={-1}
                onChoose={choose}
              />
            )}
          </div>
        ) : null}
      </div>
      <PlaceLine place={place} />
    </div>
  );
}
