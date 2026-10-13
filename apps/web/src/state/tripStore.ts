import {
  applyRemote,
  History,
  type Change,
  type Command,
  type Result,
  type TripState,
} from '@cellar/core';
import type { Outbox } from '../adapters/outbox';

/**
 * Holds a trip's state; applies commands optimistically (through undo/redo history) and hands
 * their changes to the outbox. One store per trip, so history is cleared when switching trips.
 */
export class TripStore {
  private history: History;
  private state: TripState;
  private listeners = new Set<() => void>();

  constructor(
    initial: TripState,
    private readonly outbox: Pick<Outbox, 'enqueue' | 'pendingKeys'>,
  ) {
    this.state = initial;
    this.history = new History(initial);
  }

  getState = (): TripState => this.state;

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispatch(command: Command): Result {
    return this.commit(this.history.apply(command));
  }

  undo(): Result | null {
    const result = this.history.undo();
    return result && this.commit(result);
  }

  redo(): Result | null {
    const result = this.history.redo();
    return result && this.commit(result);
  }

  /** A change from another device. */
  receive(change: Change): void {
    const next = applyRemote(this.state, change, this.outbox.pendingKeys());
    if (next !== this.state) this.setState(next);
  }

  /** Replace everything, e.g. after a reload from the server. */
  replace(state: TripState): void {
    this.setState(state);
    this.history.clear();
  }

  private commit(result: Result): Result {
    if (result.ok) {
      this.state = result.state;
      this.outbox.enqueue(result.changes);
      this.emit();
    }
    return result;
  }

  private setState(state: TripState): void {
    this.state = state;
    this.history.state = state;
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
