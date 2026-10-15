import type { PlaceSuggestion } from '@cellar/core';
import type { PlaceSuggestionStatus } from '../../state/usePlaceSuggestions';
import { Icon, MapPin } from '../ui/Icon';
import styles from './PlaceOptions.module.css';

interface Props {
  /** Id prefix shared with the combobox's aria-activedescendant. */
  id: string;
  suggestions: PlaceSuggestion[];
  activeIndex: number;
  /** How many options come before this group in the same listbox. */
  offset?: number;
  onChoose: (suggestion: PlaceSuggestion) => void;
}

export const placeOptionId = (listId: string, index: number) => `${listId}-opt-${index}`;

/** The "Places" group of a suggestion listbox. Render it inside an element with role="listbox". */
export function PlaceOptions({ id, suggestions, activeIndex, offset = 0, onChoose }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div role="group" aria-label="Places">
      {suggestions.map((s, i) => (
        <div
          key={s.placeId}
          id={placeOptionId(id, offset + i)}
          role="option"
          aria-selected={offset + i === activeIndex}
          className={`${styles.option} ${offset + i === activeIndex ? styles.active : ''}`}
          // mousedown (not click) so the input does not blur first
          onMouseDown={(e) => {
            e.preventDefault();
            onChoose(s);
          }}
        >
          <Icon as={MapPin} />
          <span className={styles.text}>
            <span className={styles.name}>{s.name}</span>
            {s.address ? <span className={styles.address}>{s.address}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Status notes and Google's attribution. Render it as a sibling after the listbox, in the same
 * popup: a listbox may only contain options and groups.
 */
export function PlaceNotes({
  hasOptions,
  status,
}: {
  hasOptions: boolean;
  status: PlaceSuggestionStatus;
}) {
  return (
    <>
      {/* Also with options: a failed pick leaves them listed. */}
      {status === 'unavailable' ? (
        <p role="status" className={styles.note}>
          Place search unavailable
        </p>
      ) : null}
      {!hasOptions && status === 'ready' ? (
        <p role="status" className={styles.note}>
          No places found
        </p>
      ) : null}
      {hasOptions || status === 'ready' ? (
        <p className={styles.attribution}>Powered by Google</p>
      ) : null}
    </>
  );
}
