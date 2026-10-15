import { useRef, useState, type FormEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  addItem,
  deleteItem,
  filterItems,
  placeItem,
  isFoodPlace,
  placedCount,
  placeOf,
  suggestNear,
  updateItem,
  type Item,
  type ItemType,
  type Place,
  type TripState,
} from '@cellar/core';
import { CellPickerDialog } from '../CellPickerDialog';
import { itemDragId } from '../grid/dndIds';
import { TYPE_ICON, TYPE_LABEL, type Dispatch } from '../grid/PlacementChip';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { Icon, MoreHorizontal, Plus, Search } from '../ui/Icon';
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu';
import { OpenInMapsItems } from '../places/OpenInMapsItems';
import { PlaceLine } from '../places/PlaceLine';
import { PlaceNameField } from '../places/PlaceNameField';
import { Popover } from '../ui/Popover';
import { TextField } from '../ui/TextField';
import styles from './ItemPanel.module.css';

type TypeFilter = 'all' | ItemType;
const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'activity', label: 'Activities' },
  { id: 'food', label: 'Food' },
];

/** Case- and accent-insensitive form used for searching. */
function fold(text: string): string {
  return text.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

interface FormProps {
  item?: Item;
  submitLabel: string;
  onSubmit: (values: {
    name: string;
    type: ItemType;
    notes: string;
    link: string;
    place: Place | null;
  }) => string | null;
  onDone?: () => void;
  near: { lat: number; lon: number } | null;
}

function ItemForm({ item, submitLabel, onSubmit, onDone, near }: FormProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<ItemType>(item?.type ?? 'activity');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [link, setLink] = useState(item?.link ?? '');
  const [place, setPlace] = useState<Place | null>(item ? placeOf(item) : null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = onSubmit({ name, type, notes, link, place });
    setError(problem);
    if (!problem) onDone?.();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {item ? (
        <TextField
          label="Name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
      ) : (
        <PlaceNameField
          value={name}
          onChange={setName}
          place={place}
          near={near}
          error={error}
          autoFocus
          onPick={(picked, suggestion) => {
            setPlace(picked);
            if (isFoodPlace(suggestion.types)) setType('food');
          }}
        />
      )}
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
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: itemDragId(item.id),
  });
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const count = placedCount(state, item.id);
  const place = placeOf(item);

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
        aria-label={`Drag ${item.name}`}
        {...attributes}
      />
      <span className={`${styles.typeIcon} ${styles[item.type]}`}>
        <Icon as={TYPE_ICON[item.type]} />
      </span>
      <span className={styles.text}>
        <span className={styles.name} data-testid="item-name">
          {item.name}
        </span>
        <PlaceLine place={place} />
      </span>
      {count > 0 ? <span className={styles.count}>placed {count}×</span> : null}
      <Menu
        trigger={
          <button type="button" className={styles.actions} aria-label={`Actions for ${item.name}`}>
            <Icon as={MoreHorizontal} />
          </button>
        }
      >
        <MenuItem aria-label={`Place ${item.name} in a block`} onSelect={() => setPlacing(true)}>
          Place in a block
        </MenuItem>
        <MenuItem aria-label={`Edit ${item.name}`} onSelect={() => setEditing(true)}>
          Edit
        </MenuItem>
        <MenuItem danger aria-label={`Delete ${item.name}`} onSelect={() => setDeleting(true)}>
          Delete
        </MenuItem>
        {place ? (
          <>
            <MenuSeparator />
            <OpenInMapsItems place={place} />
          </>
        ) : null}
      </Menu>

      {editing ? (
        <Dialog title="Edit item" onClose={() => setEditing(false)}>
          <ItemForm
            item={item}
            submitLabel="Save"
            near={suggestNear(state)}
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

export function ItemPanel({ state, dispatch }: { state: TripState; dispatch: Dispatch }) {
  const [type, setType] = useState<TypeFilter>('all');
  const [unplacedOnly, setUnplacedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const needle = fold(query.trim());
  const items = filterItems(state, {
    ...(type === 'all' ? {} : { type }),
    ...(unplacedOnly ? { placed: false } : {}),
  }).filter((item) => needle === '' || fold(item.name).includes(needle));

  return (
    <aside className={styles.panel} aria-label="Activities and food">
      <div className={styles.header}>
        <h2 className={styles.title}>Activities &amp; food</h2>
        <div ref={addRef} className={styles.addWrap}>
          <Button aria-expanded={adding} onClick={() => setAdding((o) => !o)}>
            <Icon as={Plus} />
            Add
          </Button>
          {adding ? (
            <Popover id="add-item-form" anchorRef={addRef} onClose={() => setAdding(false)}>
              <ItemForm
                submitLabel="Add to list"
                near={suggestNear(state)}
                onDone={() => setAdding(false)}
                onSubmit={({ name, type: itemType, notes, link, place }) => {
                  const r = dispatch(addItem(name, itemType, notes || null, link || null, place));
                  return r.ok ? null : r.error.message;
                }}
              />
            </Popover>
          ) : null}
        </div>
      </div>
      <div className={styles.search}>
        <Icon as={Search} />
        <input
          type="search"
          className={styles.searchInput}
          aria-label="Search items"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.filters}>
        <div className={styles.segmented} role="group" aria-label="Filter list">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${styles.segment} ${type === f.id ? styles.segmentActive : ''}`}
              aria-pressed={type === f.id}
              onClick={() => setType(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.toggleChip} ${unplacedOnly ? styles.segmentActive : ''}`}
          aria-pressed={unplacedOnly}
          onClick={() => setUnplacedOnly((o) => !o)}
        >
          Not yet placed
        </button>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>No items.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <ItemRow key={item.id} state={state} item={item} dispatch={dispatch} />
          ))}
        </ul>
      )}
    </aside>
  );
}
