import type { PlaceSuggestion } from '@cellar/core';
import type { PlaceSuggestionStatus } from '../../state/usePlaceSuggestions';
import { Icon, MapPin } from '../ui/Icon';
import styles from './PlaceOptions.module.css';

interface Props {
  /** Id prefix shared with the combobox's aria-activedescendant. */
  id: string;
  suggestions: PlaceSuggestion[];
  status: PlaceSuggestionStatus;
  activeIndex: number;
  /** How many options come before this group in the same listbox. */
  offset?: number;
  onChoose: (suggestion: PlaceSuggestion) => void;
}

export const placeOptionId = (listId: string, index: number) => `${listId}-opt-${index}`;

/**
 * The "Places" group of a suggestion listbox, with Google's attribution. Render it inside an
 * element with role="listbox" whenever it has options.
 */
export function PlaceOptions({
  id,
  suggestions,
  status,
  activeIndex,
  offset = 0,
  onChoose,
}: Props) {
  const empty = suggestions.length === 0;
  return (
    <>
      {empty ? null : (
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
      )}
      {empty && status === 'unavailable' ? (
        <p role="status" className={styles.note}>
          Place search unavailable
        </p>
      ) : null}
      {empty && status === 'ready' ? (
        <p role="status" className={styles.note}>
          No places found
        </p>
      ) : null}
      {!empty || status === 'ready' ? (
        <p className={styles.attribution}>Powered by Google</p>
      ) : null}
    </>
  );
}
