import type { Command, Result } from './commands/command';
import type { TripState } from './model/types';

/**
 * Per-trip, in-memory undo/redo (research R7). Undo applies a command's inverse as a normal
 * new change, so it persists and syncs like any edit.
 */
export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  constructor(public state: TripState) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  apply(command: Command): Result {
    const result = command(this.state);
    if (result.ok) {
      this.state = result.state;
      this.undoStack.push(result.inverse);
      this.redoStack = [];
    }
    return result;
  }

  undo(): Result | null {
    return this.step(this.undoStack, this.redoStack);
  }

  redo(): Result | null {
    return this.step(this.redoStack, this.undoStack);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private step(from: Command[], to: Command[]): Result | null {
    const command = from.pop();
    if (!command) return null;
    const result = command(this.state);
    if (result.ok) {
      this.state = result.state;
      to.push(result.inverse);
    }
    return result;
  }
}
