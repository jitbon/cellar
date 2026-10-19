import { memo, useState, type FormEvent, type MouseEvent, type PointerEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  isFoodPlace,
  movePlacement,
  placeOf,
  removePlacement,
  suggestNear,
  updatePlacement,
  type Command,
  type Place,
  type Placement,
  type Result,
  type TripState,
} from '@cellar/core';
import { CellPickerDialog } from '../CellPickerDialog';
import { PlaceDetail, linkedSubject } from '../list/PlaceDetail';
import { OpenInMapsItems } from '../places/OpenInMapsItems';
import { PlaceNameField } from '../places/PlaceNameField';
import { placementDragId } from './dndIds';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Flag, Icon, MapPin, MoreHorizontal, Utensils } from '../ui/Icon';
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu';
import { TextField } from '../ui/TextField';
import { Tooltip } from '../ui/Tooltip';
import styles from './PlacementChip.module.css';

export type Dispatch = (command: Command) => Result;

export const TYPE_LABEL = { activity: 'Activity', food: 'Food place' } as const;
export const TYPE_ICON = { activity: Flag, food: Utensils } as const;

function EditDialog({
  state,
  placement,
  dispatch,
  onClose,
}: {
  state: TripState;
  placement: Placement;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [name, setName] = useState(placement.name);
  const [place, setPlace] = useState<Place | null>(placeOf(placement));
  const [pickedFood, setPickedFood] = useState(false);
  const [notes, setNotes] = useState(placement.notes ?? '');
  const [link, setLink] = useState(placement.link ?? '');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const changed = (place?.id ?? null) !== (placeOf(placement)?.id ?? null);
    const result = dispatch(
      updatePlacement(placement.id, {
        name,
        notes: notes || null,
        link: link || null,
        ...(changed ? { place } : {}),
        ...(pickedFood && placement.type !== 'food' ? { type: 'food' as const } : {}),
      }),
    );
    if (result.ok) onClose();
    else setError(result.error.message);
  }

  return (
    <Dialog title="Edit event" onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <PlaceNameField
          value={name}
          onChange={setName}
          place={place}
          near={suggestNear(state, placement.date)}
          onPick={(picked, suggestion) => {
            setPlace(picked);
            setPickedFood(isFoodPlace(suggestion.types));
          }}
          onRemove={() => {
            setPlace(null);
            setPickedFood(false);
          }}
        />
        <label className={styles.notesLabel}>
          Notes
          <textarea
            className={styles.notes}
            value={notes}
            rows={4}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <TextField
          label="Link"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          error={error}
        />
        <div className={styles.dialogActions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The chip's look without any behavior: used inside the drag overlay. */
export function ChipFace({
  name,
  type,
  linked = false,
}: {
  name: string;
  type: Placement['type'];
  linked?: boolean;
}) {
  return (
    <>
      <span className={styles.typeIcon}>
        <Icon as={TYPE_ICON[type]} />
      </span>
      <span className={styles.name} data-chip-name>
        {name}
      </span>
      {linked ? (
        <span className={styles.typeIcon}>
          <Icon as={MapPin} size="small" role="img" aria-label="Linked place" />
        </span>
      ) : null}
    </>
  );
}

function isTruncated(el: Element | null): boolean {
  return !!el && el.scrollWidth > el.clientWidth;
}

function PlacementChipImpl({
  state,
  placement,
  dispatch,
}: {
  state: TripState;
  placement: Placement;
  dispatch: Dispatch;
}) {
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [viewing, setViewing] = useState(false);
  const other = placement.type === 'activity' ? 'food' : 'activity';
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: placementDragId(placement.id) });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const place = placeOf(placement);
  const tip = [placement.name, place?.address, placement.notes].filter(Boolean).join(' — ');

  // Menus and dialogs render in portals, but React events still bubble through them.
  const inside = (e: MouseEvent | PointerEvent) =>
    (e.currentTarget as HTMLElement).contains(e.target as Node);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`${styles.chip} ${styles[placement.type]}`}
        data-testid="chip"
        data-placeholder={isDragging ? '' : undefined}
        data-insert-before={isOver && !isDragging ? '' : undefined}
        {...listeners}
        onPointerDown={(e) => {
          if (inside(e)) listeners?.onPointerDown?.(e);
        }}
        onClick={(e) => {
          if (inside(e)) setEditing(true);
        }}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="visually-hidden"
          aria-label={`Drag ${placement.name}`}
          {...attributes}
        />
        <Tooltip
          label={tip}
          when={(el) =>
            !!placement.notes || !!place || isTruncated(el.querySelector('[data-chip-name]'))
          }
        >
          <span className={styles.face}>
            <ChipFace name={placement.name} type={placement.type} linked={!!place} />
          </span>
        </Tooltip>
        <Menu
          trigger={
            <button
              type="button"
              className={styles.actions}
              aria-label={`Actions for ${placement.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon as={MoreHorizontal} />
            </button>
          }
        >
          {place ? <MenuItem onSelect={() => setViewing(true)}>View details</MenuItem> : null}
          <MenuItem
            aria-label={`Switch ${placement.name} to ${TYPE_LABEL[other]}`}
            onSelect={() => dispatch(updatePlacement(placement.id, { type: other }))}
          >
            Switch to {TYPE_LABEL[other]}
          </MenuItem>
          <MenuItem
            aria-label={`Move ${placement.name} to another block`}
            onSelect={() => setMoving(true)}
          >
            Move to another block
          </MenuItem>
          <MenuItem aria-label={`Edit ${placement.name}`} onSelect={() => setEditing(true)}>
            Edit
          </MenuItem>
          {place ? (
            <MenuItem
              aria-label={`Remove place from ${placement.name}`}
              onSelect={() => dispatch(updatePlacement(placement.id, { place: null }))}
            >
              Remove place
            </MenuItem>
          ) : null}
          {placement.link ? (
            <MenuItem
              aria-label={`Open link for ${placement.name}`}
              onSelect={() => window.open(placement.link!, '_blank', 'noreferrer')}
            >
              Open link
            </MenuItem>
          ) : null}
          <MenuItem
            danger
            aria-label={`Remove ${placement.name}`}
            onSelect={() => dispatch(removePlacement(placement.id))}
          >
            Remove
          </MenuItem>
          {place ? (
            <>
              <MenuSeparator />
              <OpenInMapsItems place={place} />
            </>
          ) : null}
        </Menu>
      </div>
      {viewing && place ? (
        <PlaceDetail
          state={state}
          subject={linkedSubject(place)}
          type={placement.type}
          actions={
            <Button
              variant="primary"
              onClick={() => {
                setViewing(false);
                setEditing(true);
              }}
            >
              Edit event
            </Button>
          }
          onClose={() => setViewing(false)}
        />
      ) : null}
      {editing ? (
        <EditDialog
          state={state}
          placement={placement}
          dispatch={dispatch}
          onClose={() => setEditing(false)}
        />
      ) : null}
      {moving ? (
        <CellPickerDialog
          title={`Move “${placement.name}”`}
          confirmLabel="Move"
          state={state}
          onClose={() => setMoving(false)}
          onPick={(date, blockId) => {
            dispatch(movePlacement(placement.id, date, blockId));
            setMoving(false);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * A trip can hold hundreds of chips and every edit produces a new state, so chips re-render
 * only when their own placement changes; `state` is read just to list blocks for "Move".
 */
export const PlacementChip = memo(
  PlacementChipImpl,
  (a, b) =>
    a.placement === b.placement &&
    a.dispatch === b.dispatch &&
    a.state.blocks === b.state.blocks &&
    a.state.daySettings === b.state.daySettings &&
    a.state.trip === b.state.trip,
);
