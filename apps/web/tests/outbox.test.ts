import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change } from '@cellar/core';
import { Outbox, type OutboxEvent } from '../src/adapters/outbox';

const change = (id: string): Change => ({
  table: 'items',
  op: 'upsert',
  row: { id, tripId: 't', name: id },
});

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('Outbox', () => {
  it('flushes batches in order after success', async () => {
    const saved: string[] = [];
    const outbox = new Outbox(async (cs) => {
      saved.push(...cs.map((c) => c.row.id as string));
    });
    outbox.enqueue([change('a')]);
    outbox.enqueue([change('b')]);
    await vi.runAllTimersAsync();
    expect(saved).toEqual(['a', 'b']);
    expect(outbox.status).toBe('saved');
  });

  it('transient failure stays queued and status becomes retrying', async () => {
    const save = vi.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValue(undefined);
    const outbox = new Outbox(save);
    outbox.enqueue([change('a')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.status).toBe('retrying');
    expect(outbox.pendingKeys().has('items:a')).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(outbox.status).toBe('saved');
  });

  it('network errors are transient and back off up to 30 s', async () => {
    const save = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const outbox = new Outbox(save);
    outbox.enqueue([change('a')]);
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(30_000);
    expect(outbox.status).toBe('retrying');
    expect(save.mock.calls.length).toBeGreaterThan(5);
  });

  it('429 is transient', async () => {
    const save = vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValue(undefined);
    const outbox = new Outbox(save);
    outbox.enqueue([change('a')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.status).toBe('retrying');
  });

  it('permanent failure drops the batch, emits discarded, and later batches still save', async () => {
    const saved: string[] = [];
    const save = vi.fn(async (cs: Change[]) => {
      if (cs[0].row.id === 'bad') throw { status: 403, code: '42501' };
      saved.push(cs[0].row.id as string);
    });
    const outbox = new Outbox(save);
    const events: OutboxEvent[] = [];
    outbox.subscribe((e) => events.push(e));
    outbox.enqueue([change('bad')]);
    outbox.enqueue([change('good')]);
    await vi.runAllTimersAsync();
    expect(saved).toEqual(['good']);
    expect(events.some((e) => e.type === 'discarded')).toBe(true);
    expect(outbox.pendingKeys().size).toBe(0);
    expect(outbox.status).toBe('saved');
  });

  it('constraint errors without HTTP status are permanent', async () => {
    const save = vi.fn().mockRejectedValue({ code: '23514' });
    const outbox = new Outbox(save);
    const events: OutboxEvent[] = [];
    outbox.subscribe((e) => events.push(e));
    outbox.enqueue([change('a')]);
    await vi.runAllTimersAsync();
    expect(events.some((e) => e.type === 'discarded')).toBe(true);
  });

  it('queue survives reload via localStorage', async () => {
    const down = vi.fn().mockRejectedValue({ status: 500 });
    const first = new Outbox(down);
    first.enqueue([change('a')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(localStorage.getItem('cellar.outbox')).toContain('"a"');
    first.dispose();

    const saved: string[] = [];
    const second = new Outbox(async (cs) => {
      saved.push(...cs.map((c) => c.row.id as string));
    });
    expect(second.pendingKeys().has('items:a')).toBe(true);
    await vi.runAllTimersAsync();
    expect(saved).toEqual(['a']);
    expect(localStorage.getItem('cellar.outbox')).toBe('[]');
  });

  it('pendingKeys clears once a row save succeeds', async () => {
    const gate = deferred();
    const outbox = new Outbox(() => gate.promise);
    outbox.enqueue([change('a')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.status).toBe('saving');
    expect(outbox.pendingKeys().has('items:a')).toBe(true);
    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.pendingKeys().size).toBe(0);
  });

  it('retries on the online event', async () => {
    const save = vi.fn().mockRejectedValueOnce({ status: 500 }).mockResolvedValue(undefined);
    const outbox = new Outbox(save);
    outbox.enqueue([change('a')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.status).toBe('retrying');
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.status).toBe('saved');
    outbox.dispose();
  });
});
