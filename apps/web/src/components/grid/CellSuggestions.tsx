import type { Item } from '@cellar/core';
import { TYPE_ICON, TYPE_LABEL } from './PlacementCard';
import styles from './CellSuggestions.module.css';

interface Props {
  id: string;
  items: Item[];
  activeIndex: number;
  onChoose: (item: Item) => void;
}

export const optionId = (listId: string, index: number) => `${listId}-opt-${index}`;

/** Suggestion listbox shown under a cell input; keyboard handling lives with the input. */
export function CellSuggestions({ id, items, activeIndex, onChoose }: Props) {
  if (items.length === 0) return null;
  return (
    <ul id={id} role="listbox" aria-label="Suggestions from your list" className={styles.list}>
      {items.map((item, i) => (
        <li
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
          <span aria-hidden="true">{TYPE_ICON[item.type]}</span> {item.name}
          <span className={styles.type}> · {TYPE_LABEL[item.type]}</span>
        </li>
      ))}
    </ul>
  );
}
