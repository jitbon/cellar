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
import { usePlacePhoto } from '../../state/usePlacePhoto';
import { OpenInMapsItems } from '../places/OpenInMapsItems';
import { PlaceDetail } from './PlaceDetail';
import { ratingText } from './rating';
import styles from './PopularCard.module.css';

interface Props {
  state: TripState;
  place: PopularPlace;
  /** Food for the Food group, Activity for Things to do. */
  type: ItemType;
  dispatch: Dispatch;
  /** Called after "Add to my list" succeeds. */
  onAddedToList?: (name: string) => void;
}

/** Thumbnail width requested from the provider (the slot is shown at --size-thumb). */
export const THUMB_WIDTH_PX = 160;

export function PopularCard({ state, place, type, dispatch, onAddedToList }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: popularDragId(place.placeId),
    data: { place, type },
  });
  const [placing, setPlacing] = useState(false);
  const [detail, setDetail] = useState(false);
  const photo = usePlacePhoto(place.photo, THUMB_WIDTH_PX);
  // An expired image link fails to load; the type icon takes over again.
  const [broken, setBroken] = useState(false);
  const linked = popularToPlace(place);
  const meta = [place.kind, place.address].filter(Boolean).join(' · ');
  const rating = ratingText(place);
  const placed = isPlacePlaced(state, place.placeId);
  const addToList = () => {
    if (dispatch(addItem(place.name, type, null, null, linked)).ok) onAddedToList?.(place.name);
  };

  return (
    <li
      ref={setNodeRef}
      className={`${styles.row} ${isDragging ? styles.dragging : ''}`}
      {...listeners}
      // A click on the card body opens the detail view; a drag never counts as one (the pointer
      // sensor needs 5 px of movement), and clicks inside portaled menus or dialogs are not on
      // this element. Keyboard users get the name button below.
      onClick={(e) => {
        if (!(e.target instanceof Element) || !e.currentTarget.contains(e.target)) return;
        if (e.target.closest('button, a')) return;
        setDetail(true);
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="visually-hidden"
        aria-label={`Drag ${place.name}`}
        {...attributes}
      />
      <span
        ref={photo.ref}
        data-testid="popular-thumb"
        className={`${styles.thumb} ${styles[type]}`}
        title={photo.url && place.photo ? `Photo: ${place.photo.author}` : undefined}
      >
        {photo.url && !broken ? (
          <img
            className={styles.thumbImage}
            src={photo.url}
            alt=""
            onError={() => setBroken(true)}
          />
        ) : (
          <Icon as={TYPE_ICON[type]} />
        )}
      </span>
      <span className={styles.text}>
        <button type="button" className={styles.nameButton} onClick={() => setDetail(true)}>
          <span className={`${styles.name} ${placed ? styles.placed : ''}`}>
            {place.name}
            {placed ? <span className="visually-hidden">, placed</span> : null}
          </span>
        </button>
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
        <MenuItem onSelect={addToList}>Add to my list</MenuItem>
        <MenuSeparator />
        <OpenInMapsItems place={linked} />
      </Menu>
      {detail ? (
        <PlaceDetail
          state={state}
          place={place}
          type={type}
          onPlace={() => setPlacing(true)}
          onAddToList={addToList}
          onClose={() => setDetail(false)}
        />
      ) : null}
      {placing ? (
        <CellPickerDialog
          title={`Place “${place.name}”`}
          confirmLabel="Place"
          state={state}
          onClose={() => setPlacing(false)}
          onPick={(date, blockId) => {
            dispatch(placePlace(linked, type, date, blockId));
            setPlacing(false);
            setDetail(false);
          }}
        />
      ) : null}
    </li>
  );
}
