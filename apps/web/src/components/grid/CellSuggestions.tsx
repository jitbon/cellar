import type { Item, PlaceSuggestion } from '@cellar/core';
import type { PlaceSuggestionStatus } from '../../state/usePlaceSuggestions';
import { PlaceNotes, PlaceOptions } from '../places/PlaceOptions';
import { Icon } from '../ui/Icon';
import { TYPE_ICON, TYPE_LABEL } from './PlacementChip';
import styles from './CellSuggestions.module.css';

interface Props {
  id: string;
  items: Item[];
  /** Index across the list items followed by the place suggestions. */
  activeIndex: number;
  onChoose: (item: Item) => void;
  places: PlaceSuggestion[];
  placeStatus: PlaceSuggestionStatus;
  onChoosePlace: (suggestion: PlaceSuggestion) => void;
}

export const optionId = (listId: string, index: number) => `${listId}-opt-${index}`;

/** Suggestion listbox shown under a cell input; keyboard handling lives with the input. */
export function CellSuggestions({
  id,
  items,
  activeIndex,
  onChoose,
  places,
  placeStatus,
  onChoosePlace,
}: Props) {
  const hasOptions = items.length + places.length > 0;
  const hasNote = placeStatus === 'unavailable' || placeStatus === 'ready';
  if (!hasOptions && !hasNote) return null;
  // Notes and attribution are siblings after the listbox (it holds only options and groups),
  // inside the same popup. With no options there is no listbox at all.
  return (
    <div className={styles.list}>
      {hasOptions ? (
        <div id={id} role="listbox" aria-label="Suggestions">
          {items.length > 0 ? (
            <div role="group" aria-label="From your list">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  id={optionId(id, i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`${styles.option} ${i === activeIndex ? styles.active : ''}`}
                  // mousedown (not click) so the input does not blur first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChoose(item);
                  }}
                >
                  <Icon as={TYPE_ICON[item.type]} /> {item.name}
                  <span className={styles.type}> · {TYPE_LABEL[item.type]}</span>
                </div>
              ))}
            </div>
          ) : null}
          <PlaceOptions
            id={id}
            suggestions={places}
            activeIndex={activeIndex}
            offset={items.length}
            onChoose={onChoosePlace}
          />
        </div>
      ) : null}
      <PlaceNotes hasOptions={places.length > 0} status={placeStatus} />
    </div>
  );
}
