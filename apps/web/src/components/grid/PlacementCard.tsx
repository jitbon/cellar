import { useState, type FormEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  movePlacement,
  removePlacement,
  updatePlacement,
  type Command,
  type Placement,
  type Result,
  type TripState,
} from '@cellar/core';
import { CellPickerDialog } from '../CellPickerDialog';
import { placementDragId } from './dndIds';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { TextField } from '../ui/TextField';
import styles from './PlacementCard.module.css';

export type Dispatch = (command: Command) => Result;

export const TYPE_LABEL = { activity: 'Activity', food: 'Food place' } as const;
export const TYPE_ICON = { activity: '🎟', food: '🍴' } as const;

function EditDialog({
  placement,
  dispatch,
  onClose,
}: {
  placement: Placement;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [name, setName] = useState(placement.name);
  const [notes, setNotes] = useState(placement.notes ?? '');
  const [link, setLink] = useState(placement.link ?? '');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = dispatch(
      updatePlacement(placement.id, { name, notes: notes || null, link: link || null }),
    );
    if (result.ok) onClose();
    else setError(result.error.message);
  }

  return (
    <Dialog title="Edit event" onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
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
        <div className={styles.actions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function PlacementCard({
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
  const other = placement.type === 'activity' ? 'food' : 'activity';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: placementDragId(placement.id),
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${styles[placement.type]} ${isDragging ? styles.dragging : ''}`}
    >
      <div className={styles.top}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Drag ${placement.name}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className={styles.badge}>
          <span aria-hidden="true">{TYPE_ICON[placement.type]}</span> {TYPE_LABEL[placement.type]}
        </span>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Switch ${placement.name} to ${TYPE_LABEL[other]}`}
            onClick={() => dispatch(updatePlacement(placement.id, { type: other }))}
          >
            ⇄
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Move ${placement.name} to another block`}
            onClick={() => setMoving(true)}
          >
            ↗
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Edit ${placement.name}`}
            onClick={() => setEditing(true)}
          >
            ✎
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Remove ${placement.name}`}
            onClick={() => dispatch(removePlacement(placement.id))}
          >
            ✕
          </button>
        </div>
      </div>
      <span className={styles.name}>{placement.name}</span>
      {placement.notes ? <span className={styles.meta}>{placement.notes}</span> : null}
      {placement.link ? (
        <a className={styles.meta} href={placement.link} target="_blank" rel="noreferrer">
          Link
        </a>
      ) : null}
      {editing ? (
        <EditDialog placement={placement} dispatch={dispatch} onClose={() => setEditing(false)} />
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
    </div>
  );
}
