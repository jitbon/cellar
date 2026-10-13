import { useState, type FormEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  addBlock,
  impactOfRemoveBlock,
  removeBlock,
  renameBlock,
  type Block,
  type TripState,
} from '@cellar/core';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { TextField } from '../ui/TextField';
import { blockDragId } from './dndIds';
import type { Dispatch } from './PlacementCard';
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

export function BlockLabel({ state, block, dispatch }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(block.name);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: blockDragId(block.id),
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

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
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Reorder ${block.name}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        {renaming ? (
          <div>
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
          <button
            type="button"
            className={styles.nameButton}
            aria-label={`Rename ${block.name}`}
            onClick={() => {
              setName(block.name);
              setRenaming(true);
            }}
          >
            {block.name}
          </button>
        )}
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Add block below ${block.name}`}
          onClick={() => setAdding(true)}
        >
          +
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Remove ${block.name}`}
          disabled={lastBlock}
          title={lastBlock ? 'A trip needs at least one time block' : undefined}
          onClick={() => setRemoving(true)}
        >
          ✕
        </button>
      </div>

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
