import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  addItem,
  deleteItem,
  filterItems,
  placeItem,
  isFoodPlace,
  matchesItemName,
  placedCount,
  placeOf,
  suggestNear,
  updateItem,
  type Item,
  type ItemType,
  type Place,
  type TripState,
} from '@cellar/core';
import { useKeyValueStore } from '../../state/services';
import { placedText, RepeatCount } from './RepeatCount';
import { CellPickerDialog } from '../CellPickerDialog';
import { itemDragId } from '../grid/dndIds';
import { TYPE_ICON, TYPE_LABEL, type Dispatch } from '../grid/PlacementChip';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { Icon, MoreHorizontal, Plus } from '../ui/Icon';
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu';
import { OpenInMapsItems } from '../places/OpenInMapsItems';
import { PlaceLine } from '../places/PlaceLine';
import { PlaceNameField } from '../places/PlaceNameField';
import { Popover } from '../ui/Popover';
import { PlaceDetail, linkedSubject } from './PlaceDetail';
import { PopularTab } from './PopularTab';
import { QuickAddLine } from './QuickAddLine';
import { TextField } from '../ui/TextField';
import { Toast } from '../ui/Toast';
import styles from './ItemPanel.module.css';

type TypeFilter = 'all' | ItemType;
type PanelTab = 'list' | 'popular';
const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: 'list', label: 'My list' },
  { id: 'popular', label: 'Popular' },
];
const TAB_KEY = 'cellar.panelTab';

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'activity', label: 'Activities' },
  { id: 'food', label: 'Food' },
];

interface FormProps {
  item?: Item;
  submitLabel: string;
  onSubmit: (values: {
    name: string;
    type: ItemType;
    notes: string;
    link: string;
    /** Undefined when the form's place is unchanged. */
    place: Place | null | undefined;
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
    const changed = (place?.id ?? null) !== (item ? (placeOf(item)?.id ?? null) : null);
    const problem = onSubmit({ name, type, notes, link, place: changed ? place : undefined });
    setError(problem);
    if (!problem) onDone?.();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
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
        onRemove={() => setPlace(null)}
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
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: itemDragId(item.id),
  });
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState(false);
  const count = placedCount(state, item.id);
  const placed = count > 0;
  const place = placeOf(item);

  return (
    <li
      ref={setNodeRef}
      className={`${styles.row} ${isDragging ? styles.dragging : ''}`}
      {...listeners}
      // Mouse shortcut for "Edit" (the menu item stays the keyboard path); not from buttons.
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) setEditing(true);
      }}
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
        <span className={styles.nameLine}>
          <span className={`${styles.name} ${placed ? styles.placed : ''}`}>
            {place ? (
              // A linked item's name opens its details; the row's double-click Edit skips buttons.
              <button type="button" className={styles.nameButton} onClick={() => setViewing(true)}>
                <span data-testid="item-name">{item.name}</span>
              </button>
            ) : (
              <span data-testid="item-name">{item.name}</span>
            )}
            {placed ? <span className="visually-hidden">{placedText(count)}</span> : null}
          </span>
          <RepeatCount count={count} />
        </span>
        <PlaceLine place={place} />
      </span>
      <Menu
        trigger={
          <button type="button" className={styles.actions} aria-label={`Actions for ${item.name}`}>
            <Icon as={MoreHorizontal} />
          </button>
        }
      >
        {place ? <MenuItem onSelect={() => setViewing(true)}>View details</MenuItem> : null}
        <MenuItem aria-label={`Place ${item.name} in a block`} onSelect={() => setPlacing(true)}>
          Place in a block
        </MenuItem>
        <MenuItem aria-label={`Edit ${item.name}`} onSelect={() => setEditing(true)}>
          Edit
        </MenuItem>
        {place ? (
          <MenuItem
            aria-label={`Remove place from ${item.name}`}
            onSelect={() => dispatch(updateItem(item.id, { place: null }))}
          >
            Remove place
          </MenuItem>
        ) : null}
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

      {viewing && place ? (
        <PlaceDetail
          state={state}
          subject={linkedSubject(place)}
          type={item.type}
          actions={
            <Button variant="primary" onClick={() => setPlacing(true)}>
              Place in a block
            </Button>
          }
          onClose={() => setViewing(false)}
        />
      ) : null}
      {editing ? (
        <Dialog title="Edit item" onClose={() => setEditing(false)}>
          <ItemForm
            item={item}
            submitLabel="Save"
            near={suggestNear(state)}
            onDone={() => setEditing(false)}
            onSubmit={({ name, type, notes, link, place: picked }) => {
              const r = dispatch(
                updateItem(item.id, {
                  name,
                  type,
                  notes: notes || null,
                  link: link || null,
                  ...(picked !== undefined ? { place: picked } : {}),
                }),
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
            setViewing(false);
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

interface PanelProps {
  state: TripState;
  dispatch: Dispatch;
  /** Opens the trip location dialog (the Popular tab needs a location). */
  onSetLocation: () => void;
}

export function ItemPanel({ state, dispatch, onSetLocation }: PanelProps) {
  const store = useKeyValueStore();
  const [query, setQuery] = useState('');
  const tabsId = useId();
  const [tab, setTab] = useState<PanelTab>(() =>
    store?.get(TAB_KEY) === 'popular' ? 'popular' : 'list',
  );
  const selectTab = (next: PanelTab, focus = false) => {
    setTab(next);
    setQuery(''); // the quick-add line starts empty when its tab comes back
    store?.set(TAB_KEY, next);
    if (focus) document.getElementById(`${tabsId}-tab-${next}`)?.focus();
  };
  // ARIA tabs pattern: arrows (and Home/End) move between tabs and select them.
  const onTabKeyDown = (e: KeyboardEvent) => {
    const at = PANEL_TABS.findIndex((t) => t.id === tab);
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowLeft'
        ? (at + (e.key === 'ArrowRight' ? 1 : PANEL_TABS.length - 1)) % PANEL_TABS.length
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? PANEL_TABS.length - 1
            : -1;
    if (to < 0) return;
    e.preventDefault();
    selectTab(PANEL_TABS[to].id, true);
  };
  const [type, setType] = useState<TypeFilter>('all');
  const [unplacedOnly, setUnplacedOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  // Items added while My list is not showing get a short notice; the count restarts the toast.
  const [added, setAdded] = useState<{ name: string; n: number } | null>(null);
  const noteAdded = (name: string) => {
    if (tab !== 'list') setAdded((a) => ({ name, n: (a?.n ?? 0) + 1 }));
  };
  const addRef = useRef<HTMLDivElement>(null);
  const items = filterItems(state, {
    ...(type === 'all' ? {} : { type }),
    ...(unplacedOnly ? { placed: false } : {}),
  }).filter((item) => matchesItemName(item, query));

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
                  if (r.ok) noteAdded(name.trim());
                  return r.ok ? null : r.error.message;
                }}
              />
            </Popover>
          ) : null}
        </div>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="List views" onKeyDown={onTabKeyDown}>
        {PANEL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${tabsId}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${tabsId}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-tab-${tab}`}
        className={styles.tabPanel}
      >
        {tab === 'popular' ? (
          <PopularTab
            state={state}
            dispatch={dispatch}
            onSetLocation={onSetLocation}
            onAddedToList={noteAdded}
          />
        ) : (
          <>
            <QuickAddLine near={suggestNear(state)} dispatch={dispatch} onFilter={setQuery} />
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
          </>
        )}
      </div>
      {added ? (
        <Toast
          key={added.n}
          durationMs={4000}
          actionLabel="View list"
          onAction={() => {
            selectTab('list');
            setAdded(null);
          }}
          onDismiss={() => setAdded(null)}
        >
          Added “{added.name}” to My list
        </Toast>
      ) : null}
    </aside>
  );
}
