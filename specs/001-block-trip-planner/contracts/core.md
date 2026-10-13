# Contract: `@cellar/core` public interface

The platform-agnostic core (constitution III). UI layers (web now, mobile later) use only what
is listed here. Signatures are TypeScript; bodies are implementation details.

## Types

```ts
type ItemType = 'activity' | 'food';
type ISODate = string; // 'YYYY-MM-DD'

interface Trip { id; ownerId; name; startDate: ISODate; endDate: ISODate; deletedAt: string | null;
               updatedAt }
interface Block { id; tripId; name; position: string; updatedAt }
interface DaySetting { tripId; date: ISODate; arrivalBlockId: string | null;
                       departureBlockId: string | null; updatedAt }
interface Item { id; tripId; name; type: ItemType; notes: string | null; link: string | null;
                 updatedAt }
interface Placement { id; tripId; date: ISODate; blockId; position: string; name; type: ItemType;
                      notes: string | null; link: string | null; sourceItemId: string | null;
                      updatedAt }

interface TripState { trip: Trip; blocks: Block[]; daySettings: DaySetting[]; items: Item[];
                      placements: Placement[] }
```

## Commands (each pure: `(state, args) => Result`)

```ts
type Change = { table: 'trips'|'blocks'|'day_settings'|'items'|'placements';
                op: 'upsert'|'delete'; row: object };
type Result = { ok: true; state: TripState; changes: Change[]; inverse: Command }
            | { ok: false; error: ValidationError };
```

| Command | Spec |
|---|---|
| `createTrip(ownerId, name, start, end)` → state with 7 default blocks | FR-001, FR-005 |
| `updateTripDates(start, end)` → also returns `removedPlacementCount` for the warning | FR-002, FR-003 |
| `renameTrip(name)` | FR-002 |
| `addBlock(name, afterBlockId?)` / `renameBlock` / `moveBlock(id, beforeId?)` / `removeBlock(id)` | FR-006 |
| `setDayWindow(date, arrivalBlockId?, departureBlockId?)` | FR-006a |
| `addItem` / `updateItem` / `deleteItem` | FR-008, FR-009 |
| `addTypedPlacement(date, blockId, name, afterPlacementId?)` | FR-007 |
| `placeItem(itemId, date, blockId, beforePlacementId?)` | FR-011, FR-012, FR-007a |
| `movePlacement(id, date, blockId, beforePlacementId?)` | FR-013 |
| `updatePlacement(id, patch)` / `removePlacement(id)` | FR-013, FR-014 |

Errors: `ValidationError` with a `code` (`EMPTY_NAME`, `END_BEFORE_START`, `RANGE_TOO_LONG`,
`LAST_BLOCK`, `ARRIVAL_AFTER_DEPARTURE`, `DATE_OUT_OF_RANGE`, `INVALID_LINK`, `NOT_FOUND`) and a
user-facing message.

## Queries (pure)

```ts
days(trip): { date: ISODate; weekday: string }[]
cell(state, date, blockId): Placement[]                       // ordered by position, then id
isGreyed(state, date, blockId): boolean                       // FR-006a
placedCount(state, itemId): number                            // FR-010
filterItems(state, { type?: ItemType; placed?: boolean }): Item[]   // FR-010
suggestItems(state, query: string, limit = 5): Item[]         // FR-007a
impactOfRemoveBlock(state, blockId): { placements: number; daySettingsCleared: number }
```

`suggestItems`: case- and accent-insensitive; names starting with the query rank above names
containing it; empty query returns nothing.

## Undo / redo

```ts
class History { apply(cmd): Result; undo(): Result | null; redo(): Result | null;
                canUndo; canRedo; clear() }
```

Per trip, in memory. `undo` returns the changes to persist, like any command (research R7).

## Remote merge

```ts
applyRemote(state, change: Change, pendingKeys: Set<string>): TripState
// last-write-wins by updatedAt; changes to rows in pendingKeys (unsaved local edits) are
// ignored; a DELETE may carry only the primary key (research R5)
```

## Platform ports (implemented by each app)

```ts
interface TripRepository {
  listTrips(): Promise<Trip[]>;
  loadTrip(tripId): Promise<TripState>;
  save(changes: Change[]): Promise<void>;          // rejects on failure; caller keeps outbox
  listDeletedTrips(): Promise<Trip[]>;            // "Recently deleted"
  deleteTrip(tripId): Promise<void>;               // soft delete (sets deletedAt)
  restoreTrip(tripId): Promise<void>;
  subscribe(tripId, onChange: (c: Change) => void): () => void;   // returns unsubscribe
}

interface AuthService {
  signUp(email, password); signIn(email, password): Promise<{ deletionCancelled: boolean }>;
  signOut(); requestPasswordReset(email); updatePassword(newPassword);
  requestAccountDeletion(): Promise<void>;
  currentUser(): { id; email } | null;
  onAuthChange(cb): () => void;
}
```
