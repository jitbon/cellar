import { useRef, useState, type FormEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  addBlock,
  impactOfRemoveBlock,
  removeBlock,
  effectiveWindow,
  isMealBlock,
  renameBlock,
  setBlockMeal,
  setBlockWindow,
  type Block,
  type TripState,
} from '@cellar/core';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { GripVertical, Icon, MoreHorizontal, Utensils } from '../ui/Icon';
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu';
import { Tooltip } from '../ui/Tooltip';
import { TextField } from '../ui/TextField';
import { blockDragId } from './dndIds';
import type { Dispatch } from './PlacementChip';
import styles from './BlockLabel.module.css';

interface Props {
  state: TripState;
  block: Block;
  dispatch: Dispatch;
}

function AddBlockDialog({
  block,
  dispatch,
  onClose,
}: {
  block: Block;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = dispatch(addBlock(name, block.id));
    if (result.ok) onClose();
    else setError(result.error.message);
  }

  return (
    <Dialog title={`Add block below ${block.name}`} onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <TextField
          label="Block name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <div className={styles.actions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Add block
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const fromTime = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

function WindowDialog({
  state,
  block,
  dispatch,
  onClose,
}: {
  state: TripState;
  block: Block;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const current = effectiveWindow(state, block.id);
  const [start, setStart] = useState(toTime(current.startMin));
  const [end, setEnd] = useState(toTime(current.endMin));
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (start === '' || end === '') {
      setError('Enter a start and end time.');
      return;
    }
    const result = dispatch(
      setBlockWindow(block.id, { startMin: fromTime(start), endMin: fromTime(end) }),
    );
    if (result.ok) onClose();
    else setError(result.error.message);
  }

  return (
    <Dialog title={`Time window for ${block.name}`} onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        <TextField
          label="Starts"
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <TextField
          label="Ends"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
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

export function BlockLabel({ state, block, dispatch }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(block.name);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editingWindow, setEditingWindow] = useState(false);
  const renameRequested = useRef(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: blockDragId(block.id),
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  function startRename() {
    renameRequested.current = true;
    setName(block.name);
    setRenaming(true);
  }

  function commitRename() {
    if (name.trim() === block.name) {
      setRenaming(false);
      setError(null);
      return;
    }
    const result = dispatch(renameBlock(block.id, name));
    if (result.ok) {
      setRenaming(false);
      setError(null);
    } else {
      setError(result.error.message);
    }
  }

  const meal = isMealBlock(block);
  const impact = impactOfRemoveBlock(state, block.id);
  const lastBlock = state.blocks.length === 1;
  const affectedDays = state.daySettings
    .filter((d) => d.arrivalBlockId === block.id || d.departureBlockId === block.id)
    .map((d) => d.date);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.label} ${isDragging ? styles.dragging : ''}`}
    >
      <div className={styles.nameRow}>
        {renaming ? (
          <div className={styles.renameField}>
            <input
              autoFocus
              className={styles.input}
              aria-label={`Rename ${block.name}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setName(block.name);
                  setError(null);
                  setRenaming(false);
                }
              }}
              onBlur={commitRename}
            />
            {error ? (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            {meal ? (
              <span className={styles.mealIcon}>
                <Icon as={Utensils} size="small" role="img" aria-label="Meal row" />
              </span>
            ) : null}
            <Tooltip label={block.name} when={(el) => el.scrollWidth > el.clientWidth}>
              <button
                type="button"
                className={styles.nameButton}
                aria-label={`Rename ${block.name}`}
                onClick={startRename}
              >
                {block.name}
              </button>
            </Tooltip>
          </>
        )}
        {renaming ? null : (
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={`Reorder ${block.name}`}
              {...attributes}
              {...listeners}
            >
              <Icon as={GripVertical} />
            </button>
            <Menu
              onCloseAutoFocus={(e) => {
                if (renameRequested.current) {
                  e.preventDefault();
                  renameRequested.current = false;
                }
              }}
              trigger={
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Options for ${block.name}`}
                >
                  <Icon as={MoreHorizontal} />
                </button>
              }
            >
              <MenuItem aria-label={`Rename ${block.name}`} onSelect={startRename}>
                Rename
              </MenuItem>
              <MenuItem
                aria-label={`Edit time window for ${block.name}`}
                onSelect={() => setEditingWindow(true)}
              >
                Edit time window
              </MenuItem>
              <MenuItem
                aria-label={
                  meal ? `${block.name} is not a meal row` : `Make ${block.name} a meal row`
                }
                onSelect={() => dispatch(setBlockMeal(block.id, !meal))}
              >
                {meal ? 'Not a meal row' : 'Make meal row'}
              </MenuItem>
              <MenuItem
                aria-label={`Add block below ${block.name}`}
                onSelect={() => setAdding(true)}
              >
                Add block below
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                danger
                disabled={lastBlock}
                aria-label={`Remove ${block.name}`}
                onSelect={() => setRemoving(true)}
              >
                Remove
              </MenuItem>
            </Menu>
          </div>
        )}
      </div>

      {editingWindow ? (
        <WindowDialog
          state={state}
          block={block}
          dispatch={dispatch}
          onClose={() => setEditingWindow(false)}
        />
      ) : null}
      {adding ? (
        <AddBlockDialog block={block} dispatch={dispatch} onClose={() => setAdding(false)} />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove ${block.name}?`}
          confirmLabel="Remove block"
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            dispatch(removeBlock(block.id));
            setRemoving(false);
          }}
        >
          <p>
            This deletes {impact.placements} placement{impact.placements === 1 ? '' : 's'} in this
            block.
          </p>
          {affectedDays.length > 0 ? (
            <p>Arrival/departure will be cleared on: {affectedDays.join(', ')}.</p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
