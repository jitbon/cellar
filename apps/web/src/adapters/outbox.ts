import { rowKey, type Change } from '@cellar/core';

export type OutboxStatus = 'saved' | 'saving' | 'retrying';
export type OutboxEvent =
  { type: 'status'; status: OutboxStatus } | { type: 'discarded'; changes: Change[] };

const STORAGE_KEY = 'cellar.outbox';
const BACKOFF_START_MS = 1000;
const BACKOFF_CAP_MS = 30_000;

/** HTTP 4xx (except 429) and Postgres constraint/RLS errors are permanent; the rest are transient. */
export function isPermanentError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { status, code } = err as { status?: unknown; code?: unknown };
  if (typeof status === 'number') {
    return status >= 400 && status < 500 && status !== 429;
  }
  return typeof code === 'string' && /^(22|23|42|PGRST)/.test(code);
}

export class Outbox {
  status: OutboxStatus = 'saved';

  private queue: Change[][] = [];
  private listeners = new Set<(e: OutboxEvent) => void>();
  private flushing = false;
  private backoff = BACKOFF_START_MS;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onOnline = () => this.retryNow();

  constructor(private readonly save: (changes: Change[]) => Promise<void>) {
    this.queue = this.restore();
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
    if (this.queue.length > 0) void this.flush();
  }

  enqueue(changes: Change[]): void {
    if (changes.length === 0) return;
    this.queue.push(changes);
    this.persist();
    void this.flush();
  }

  pendingKeys(): Set<string> {
    const keys = new Set<string>();
    for (const batch of this.queue) for (const c of batch) keys.add(rowKey(c.table, c.row));
    return keys;
  }

  subscribe(listener: (e: OutboxEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  private retryNow(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.backoff = BACKOFF_START_MS;
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.timer) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue[0];
        this.setStatus('saving');
        try {
          await this.save(batch);
        } catch (err) {
          if (isPermanentError(err)) {
            this.queue.shift();
            this.persist();
            this.emit({ type: 'discarded', changes: batch });
            continue;
          }
          this.setStatus('retrying');
          this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush();
          }, this.backoff);
          this.backoff = Math.min(this.backoff * 2, BACKOFF_CAP_MS);
          return;
        }
        this.queue.shift();
        this.persist();
        this.backoff = BACKOFF_START_MS;
      }
      this.setStatus('saved');
    } finally {
      this.flushing = false;
    }
  }

  private setStatus(status: OutboxStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit({ type: 'status', status });
  }

  private emit(event: OutboxEvent): void {
    for (const l of this.listeners) l(event);
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // storage unavailable: the in-memory queue still works for this session
    }
  }

  private restore(): Change[][] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Change[][]) : [];
    } catch {
      return [];
    }
  }
}
