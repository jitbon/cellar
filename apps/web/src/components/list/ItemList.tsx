import { useState, type FormEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  addItem,
  deleteItem,
  filterItems,
  placeItem,
  placedCount,
  updateItem,
  type Item,
  type ItemType,
  type TripState,
} from '@cellar/core';
import { CellPickerDialog } from '../CellPickerDialog';
import { itemDragId } from '../grid/dndIds';
import { TYPE_ICON, TYPE_LABEL, type Dispatch } from '../grid/PlacementCard';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { TextField } from '../ui/TextField';
import styles from './ItemList.module.css';

type Filter = 'all' | 'activity' | 'food' | 'unplaced';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'activity', label: 'Activities' },
  { id: 'food', label: 'Food' },
  { id: 'unplaced', label: 'Not yet placed' },
];

interface FormProps {
  item?: Item;
  submitLabel: string;
  onSubmit: (values: {
    name: string;
    type: ItemType;
    notes: string;
    link: string;
  }) => string | null;
  onDone?: () => void;
}

function ItemForm({ item, submitLabel, onSubmit, onDone }: FormProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<ItemType>(item?.type ?? 'activity');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [link, setLink] = useState(item?.link ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = onSubmit({ name, type, notes, link });
    setError(problem);
    if (!problem) {
      if (!item) {
        setName('');
        setNotes('');
        setLink('');
      }
      onDone?.();
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
      />
      <label className={styles.field}>
        Type
        <select
          className={styles.select}
          value={type}
          onChange={(e) => setType(e.target.value as ItemType)}
        >
          <option value="activity">{TYPE_LABEL.activity}</option>
          <option value="food">{TYPE_LABEL.food}</option>
        </select>
      </label>
      <label className={styles.field}>
        Notes
        <textarea
          className={styles.textarea}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <TextField label="Link" type="url" value={link} onChange={(e) => setLink(e.target.value)} />
      <Button type="submit" variant="primary">
        {submitLabel}
      </Button>
    </form>
  );
}

function ItemRow({ state, item, dispatch }: { state: TripState; item: Item; dispatch: Dispatch }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: itemDragId(item.id),
  });
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const count = placedCount(state, item.id);

  return (
    <li ref={setNodeRef} className={`${styles.row} ${isDragging ? styles.dragging : ''}`}>
      <button
        type="button"
        className={styles.handle}
        aria-label={`Drag ${item.name}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className={styles.rowBody}>
        <strong className={styles.rowName}>{item.name}</strong>
        <span className={styles.meta}>
          <span aria-hidden="true">{TYPE_ICON[item.type]}</span> {TYPE_LABEL[item.type]} · placed{' '}
          {count}×
        </span>
      </div>
      <div className={styles.rowActions}>
        <Button
          variant="ghost"
          aria-label={`Place ${item.name} in a block`}
          onClick={() => setPlacing(true)}
        >
          Place
        </Button>
        <Button variant="ghost" aria-label={`Edit ${item.name}`} onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button
          variant="ghost"
          aria-label={`Delete ${item.name}`}
          onClick={() => setDeleting(true)}
        >
          Delete
        </Button>
      </div>

      {editing ? (
        <Dialog title="Edit item" onClose={() => setEditing(false)}>
          <ItemForm
            item={item}
            submitLabel="Save"
            onDone={() => setEditing(false)}
            onSubmit={({ name, type, notes, link }) => {
              const r = dispatch(
                updateItem(item.id, { name, type, notes: notes || null, link: link || null }),
              );
              return r.ok ? null : r.error.message;
            }}
          />
        </Dialog>
      ) : null}
      {placing ? (
        <CellPickerDialog
          title={`Place “${item.name}”`}
          confirmLabel="Place"
          state={state}
          onClose={() => setPlacing(false)}
          onPick={(date, blockId) => {
            dispatch(placeItem(item.id, date, blockId));
            setPlacing(false);
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete item?"
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            dispatch(deleteItem(item.id));
            setDeleting(false);
          }}
        >
          “{item.name}” will be removed from the list. Copies already placed in the schedule stay.
        </ConfirmDialog>
      ) : null}
    </li>
  );
}

export function ItemList({ state, dispatch }: { state: TripState; dispatch: Dispatch }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState(false);
  const items = filterItems(
    state,
    filter === 'activity' || filter === 'food'
      ? { type: filter }
      : filter === 'unplaced'
        ? { placed: false }
        : {},
  );

  return (
    <aside className={styles.panel} data-open={open} aria-label="Activities and food">
      <div className={styles.header}>
        <h2 className={styles.title}>Activities &amp; food</h2>
        <Button className={styles.toggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide list' : 'Show list'}
        </Button>
      </div>
      <div className={styles.content}>
        <ItemForm
          submitLabel="Add to list"
          onSubmit={({ name, type, notes, link }) => {
            const r = dispatch(addItem(name, type, notes || null, link || null));
            return r.ok ? null : r.error.message;
          }}
        />
        <div className={styles.chips} role="group" aria-label="Filter list">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${styles.chip} ${filter === f.id ? styles.chipActive : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <p className={styles.meta}>No items.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <ItemRow key={item.id} state={state} item={item} dispatch={dispatch} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
