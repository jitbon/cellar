import { useEffect, useId, useRef, useState } from 'react';
import { addItem, isFoodPlace, type PlaceSuggestion } from '@cellar/core';
import { usePlaceSuggestions } from '../../state/usePlaceSuggestions';
import type { Dispatch } from '../grid/PlacementChip';
import { PlaceNotes, PlaceOptions, placeOptionId } from '../places/PlaceOptions';
import { Icon, Plus } from '../ui/Icon';
import styles from './QuickAddLine.module.css';

interface Props {
  near: { lat: number; lon: number } | null;
  dispatch: Dispatch;
  /** Called with the line's text on every change, so the list can narrow to matches. */
  onFilter: (text: string) => void;
}

/**
 * The list's top line: Enter adds the typed name as an Activity, picking a place suggestion adds
 * a linked item, and whatever is typed also narrows the list (the caller applies `onFilter`).
 */
export function QuickAddLine({ near, dispatch, onFilter }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pickFailed, setPickFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = usePlaceSuggestions(text, near);
  const { suggestions, pick } = search;
  const status = pickFailed ? 'unavailable' : search.status;
  const hasOptions = open && suggestions.length > 0;
  const showPanel =
    open && (suggestions.length > 0 || status === 'ready' || status === 'unavailable');

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  function change(value: string) {
    setText(value);
    onFilter(value);
    setOpen(true);
    setPickFailed(false);
    setError(null);
  }

  function added(result: ReturnType<Dispatch>) {
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    change('');
    inputRef.current?.focus();
  }

  function choose(suggestion: PlaceSuggestion) {
    pick(suggestion).then(
      (place) =>
        added(
          dispatch(
            addItem(
              place.name,
              isFoodPlace(suggestion.types) ? 'food' : 'activity',
              null,
              null,
              place,
            ),
          ),
        ),
      () => {
        setPickFailed(true);
        setActiveIndex(-1);
      },
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.line}>
        <Icon as={Plus} />
        <input
          ref={inputRef}
          className={styles.input}
          role="combobox"
          aria-label="Add or filter items"
          placeholder="Add an item…"
          autoComplete="off"
          aria-expanded={hasOptions}
          aria-controls={hasOptions ? listId : undefined}
          aria-activedescendant={
            hasOptions && activeIndex >= 0 ? placeOptionId(listId, activeIndex) : undefined
          }
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          value={text}
          onChange={(e) => change(e.target.value)}
          onBlur={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && hasOptions) {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp' && hasOptions) {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (hasOptions && suggestions[activeIndex]) choose(suggestions[activeIndex]);
              else if (text.trim() !== '') added(dispatch(addItem(text.trim(), 'activity')));
            } else if (e.key === 'Escape' && showPanel) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {showPanel ? (
        <div className={styles.panel}>
          {hasOptions ? (
            <div id={listId} role="listbox" aria-label="Place suggestions">
              <PlaceOptions
                id={listId}
                suggestions={suggestions}
                activeIndex={activeIndex}
                onChoose={choose}
              />
            </div>
          ) : null}
          <PlaceNotes hasOptions={hasOptions} status={status} />
        </div>
      ) : null}
    </div>
  );
}
