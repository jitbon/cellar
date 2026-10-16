import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  addItem,
  isPlacePlaced,
  placePlace,
  popularToPlace,
  type ItemType,
  type PopularPlace,
  type TripState,
} from '@cellar/core';
import { CellPickerDialog } from '../CellPickerDialog';
import { popularDragId } from '../grid/dndIds';
import { TYPE_ICON, type Dispatch } from '../grid/PlacementChip';
import { Icon, MoreHorizontal, Star } from '../ui/Icon';
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu';
import { OpenInMapsItems } from '../places/OpenInMapsItems';
import styles from './PopularCard.module.css';

interface Props {
  state: TripState;
  place: PopularPlace;
  /** Food for the Food group, Activity for Things to do. */
  type: ItemType;
  dispatch: Dispatch;
}

/** "4.8 (104,512 reviews)"; whatever part the provider did not give is left out. */
export function ratingText(place: PopularPlace): string {
  if (place.rating === null) return '';
  const rating = place.rating.toFixed(1);
  if (place.ratingCount === null) return rating;
  const reviews = place.ratingCount === 1 ? 'review' : 'reviews';
  return `${rating} (${place.ratingCount.toLocaleString('en-US')} ${reviews})`;
}

export function PopularCard({ state, place, type, dispatch }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: popularDragId(place.placeId),
    data: { place, type },
  });
  const [placing, setPlacing] = useState(false);
  const linked = popularToPlace(place);
  const meta = [place.kind, place.address].filter(Boolean).join(' · ');
  const rating = ratingText(place);
  const placed = isPlacePlaced(state, place.placeId);

  return (
    <li
      ref={setNodeRef}
      className={`${styles.row} ${isDragging ? styles.dragging : ''}`}
      {...listeners}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="visually-hidden"
        aria-label={`Drag ${place.name}`}
        {...attributes}
      />
      <span className={`${styles.typeIcon} ${styles[type]}`}>
        <Icon as={TYPE_ICON[type]} />
      </span>
      <span className={styles.text}>
        <span className={`${styles.name} ${placed ? styles.placed : ''}`}>
          {place.name}
          {placed ? <span className="visually-hidden">, placed</span> : null}
        </span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
        {rating ? (
          <span className={styles.meta}>
            <Icon as={Star} size="small" />
            <span>{rating}</span>
          </span>
        ) : null}
      </span>
      <Menu
        trigger={
          <button type="button" className={styles.actions} aria-label={`Actions for ${place.name}`}>
            <Icon as={MoreHorizontal} />
          </button>
        }
      >
        <MenuItem onSelect={() => setPlacing(true)}>Place in a block</MenuItem>
        <MenuItem onSelect={() => dispatch(addItem(place.name, type, null, null, linked))}>
          Add to my list
        </MenuItem>
        <MenuSeparator />
        <OpenInMapsItems place={linked} />
      </Menu>
      {placing ? (
        <CellPickerDialog
          title={`Place “${place.name}”`}
          confirmLabel="Place"
          state={state}
          onClose={() => setPlacing(false)}
          onPick={(date, blockId) => {
            dispatch(placePlace(linked, type, date, blockId));
            setPlacing(false);
          }}
        />
      ) : null}
    </li>
  );
}
