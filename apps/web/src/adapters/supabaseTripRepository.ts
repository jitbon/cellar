import type { Change, Table, Trip, TripRepository, TripState } from '@cellar/core';
import type { SupabaseClient } from '@supabase/supabase-js';

export class TripNotFoundError extends Error {
  constructor() {
    super('Trip not found');
  }
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function mapKeys(row: Record<string, unknown>, fn: (k: string) => string) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[fn(k)] = v;
  return out;
}

export const fromDb = (row: Record<string, unknown>) => mapKeys(row, camel);

/** updated_at is server-set, so it is never sent. */
function toDb(row: Record<string, unknown>) {
  const out = mapKeys(row, snake);
  delete out.updated_at;
  return out;
}

const TABLES: Table[] = ['trips', 'blocks', 'day_settings', 'items', 'placements'];

function toTrip(row: Record<string, unknown>): Trip {
  return fromDb(row) as unknown as Trip;
}

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export class SupabaseTripRepository implements TripRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listTrips(): Promise<Trip[]> {
    const data = check(
      await this.client
        .from('trips')
        .select('*')
        .is('deleted_at', null)
        .order('start_date', { ascending: true }),
    );
    return data.map(toTrip);
  }

  async listDeletedTrips(): Promise<Trip[]> {
    const data = check(
      await this.client
        .from('trips')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
    );
    return data.map(toTrip);
  }

  async loadTrip(tripId: string): Promise<TripState> {
    const tripRes = await this.client
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .is('deleted_at', null)
      .maybeSingle();
    const tripRow = check(tripRes);
    if (!tripRow) throw new TripNotFoundError();

    const [blocks, daySettings, items, placements] = await Promise.all(
      (['blocks', 'day_settings', 'items', 'placements'] as const).map(async (table) =>
        check(await this.client.from(table).select('*').eq('trip_id', tripId)).map(fromDb),
      ),
    );
    return {
      trip: toTrip(tripRow),
      blocks,
      daySettings,
      items,
      placements,
    } as unknown as TripState;
  }

  async save(changes: Change[]): Promise<void> {
    // Group consecutive same-table/same-op changes into one request, preserving overall order.
    let i = 0;
    while (i < changes.length) {
      const { table, op } = changes[i];
      let j = i;
      while (j < changes.length && changes[j].table === table && changes[j].op === op) j++;
      const group = changes.slice(i, j);
      i = j;

      if (op === 'upsert') {
        const onConflict = table === 'day_settings' ? 'trip_id,date' : 'id';
        const { error } = await this.client.from(table).upsert(
          group.map((c) => toDb(c.row)),
          { onConflict },
        );
        if (error) throw error;
      } else if (table === 'day_settings') {
        for (const c of group) {
          const { error } = await this.client
            .from(table)
            .delete()
            .eq('trip_id', c.row.tripId as string)
            .eq('date', c.row.date as string);
          if (error) throw error;
        }
      } else {
        const { error } = await this.client
          .from(table)
          .delete()
          .in(
            'id',
            group.map((c) => c.row.id as string),
          );
        if (error) throw error;
      }
    }
  }

  async deleteTrip(tripId: string): Promise<void> {
    const { error } = await this.client
      .from('trips')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', tripId);
    if (error) throw error;
  }

  async restoreTrip(tripId: string): Promise<void> {
    const { error } = await this.client.from('trips').update({ deleted_at: null }).eq('id', tripId);
    if (error) throw error;
  }

  subscribe(tripId: string, onChange: (c: Change) => void): () => void {
    const channel = this.client.channel(`trip:${tripId}`);
    for (const table of TABLES) {
      const filter = table === 'trips' ? `id=eq.${tripId}` : `trip_id=eq.${tripId}`;
      for (const event of ['INSERT', 'UPDATE'] as const) {
        channel.on('postgres_changes', { event, schema: 'public', table, filter }, (payload) => {
          onChange({ table, op: 'upsert', row: fromDb(payload.new as Record<string, unknown>) });
        });
      }
      // DELETE events cannot be filtered and carry only the primary key under RLS (research R5).
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (payload) => {
        onChange({ table, op: 'delete', row: fromDb(payload.old as Record<string, unknown>) });
      });
    }
    channel.subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
