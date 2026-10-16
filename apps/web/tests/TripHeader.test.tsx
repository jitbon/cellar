import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { KeyValueStore } from '@cellar/core';
import { TripHeader } from '../src/components/layout/TripHeader';
import { TooltipProvider } from '../src/components/ui/Tooltip';
import { withServices } from './setup';

const KEY = 'cellar.banner.hidden';

function memoryStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const store: KeyValueStore = {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
  return { store, map };
}

function setup(opts: { hidden?: boolean; locationName?: string | null } = {}) {
  const { store, map } = memoryStore(opts.hidden ? { [KEY]: '1' } : {});
  const Wrapper = withServices({ store });
  render(
    <MemoryRouter>
      <TooltipProvider>
        <TripHeader
          name="Japan"
          rangeLabel="Apr 10 – Apr 14 · 5 days"
          locationName={opts.locationName === undefined ? 'Kyoto, Japan' : opts.locationName}
          canUndo={false}
          canRedo={false}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onEditDates={vi.fn()}
          onEditLocation={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </TooltipProvider>
    </MemoryRouter>,
    { wrapper: Wrapper },
  );
  return { map, user: userEvent.setup() };
}

const openMenu = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'More trip actions' }));

describe('TripHeader banner toggle', () => {
  it('offers "Hide city banner" and stores the choice', async () => {
    const { map, user } = setup();
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Hide city banner' }));
    expect(map.get(KEY)).toBe('1');
  });

  it('offers "Show city banner" when hidden and clears the choice', async () => {
    const { map, user } = setup({ hidden: true });
    await openMenu(user);
    expect(screen.queryByRole('menuitem', { name: 'Hide city banner' })).toBeNull();
    await user.click(await screen.findByRole('menuitem', { name: 'Show city banner' }));
    expect(map.has(KEY)).toBe(false);
  });

  it('is not offered when the trip has no location (there is no banner to hide)', async () => {
    const { user } = setup({ locationName: null });
    await openMenu(user);
    expect(await screen.findByRole('menuitem', { name: 'Trip settings' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /city banner/ })).toBeNull();
  });
});
