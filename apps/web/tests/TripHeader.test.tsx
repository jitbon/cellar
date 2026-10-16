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

function setup(
  opts: {
    hidden?: boolean;
    locationName?: string | null;
    onChangeBannerPhoto?: () => void;
    onRename?: (name: string) => string | null;
    showLocation?: boolean;
  } = {},
) {
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
          onChangeBannerPhoto={opts.onChangeBannerPhoto ?? vi.fn()}
          onRename={opts.onRename ?? vi.fn(() => null)}
          showLocation={opts.showLocation}
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

describe('TripHeader banner photo', () => {
  it('offers "Change banner photo" for a located trip with the banner shown', async () => {
    const onChangeBannerPhoto = vi.fn();
    const { user } = setup({ onChangeBannerPhoto });
    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Change banner photo' }));
    expect(onChangeBannerPhoto).toHaveBeenCalledTimes(1);
  });

  it('is not offered when the banner is hidden or the trip has no location', async () => {
    const hidden = setup({ hidden: true });
    await openMenu(hidden.user);
    await screen.findByRole('menuitem', { name: 'Show city banner' });
    expect(screen.queryByRole('menuitem', { name: 'Change banner photo' })).toBeNull();
  });
});

describe('TripHeader rename by clicking the name', () => {
  it('turns the name into a field; Enter saves the trimmed name', async () => {
    const onRename = vi.fn(() => null);
    const { user } = setup({ onRename });
    await user.click(screen.getByRole('button', { name: 'Rename trip (Japan)' }));
    const field = screen.getByRole('textbox', { name: 'Trip name' });
    expect(field).toHaveValue('Japan');
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, '  Japan spring {Enter}');
    expect(onRename).toHaveBeenCalledWith('Japan spring');
    expect(screen.queryByRole('textbox', { name: 'Trip name' })).toBeNull();
  });

  it('saves when the field loses focus', async () => {
    const onRename = vi.fn(() => null);
    const { user } = setup({ onRename });
    await user.click(screen.getByRole('button', { name: 'Rename trip (Japan)' }));
    await user.type(screen.getByRole('textbox', { name: 'Trip name' }), ' trip');
    await user.tab();
    expect(onRename).toHaveBeenCalledWith('Japan trip');
  });

  it('Escape cancels without saving', async () => {
    const onRename = vi.fn(() => null);
    const { user } = setup({ onRename });
    await user.click(screen.getByRole('button', { name: 'Rename trip (Japan)' }));
    await user.type(screen.getByRole('textbox', { name: 'Trip name' }), ' trip{Escape}');
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Rename trip (Japan)' })).toBeInTheDocument();
  });

  it('does not save an unchanged name and keeps the field open on an error', async () => {
    const onRename = vi.fn(() => 'Please enter a name.');
    const { user } = setup({ onRename });
    await user.click(screen.getByRole('button', { name: 'Rename trip (Japan)' }));
    await user.keyboard('{Enter}');
    expect(onRename).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Rename trip (Japan)' }));
    await user.clear(screen.getByRole('textbox', { name: 'Trip name' }));
    await user.keyboard('x{Enter}');
    expect(onRename).toHaveBeenCalledWith('x');
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a name.');
    expect(screen.getByRole('textbox', { name: 'Trip name' })).toBeInTheDocument();
  });
});

describe('TripHeader location chip', () => {
  it('shows the location chip by default', () => {
    setup();
    expect(
      screen.getByRole('button', { name: 'Change trip location (Kyoto, Japan)' }),
    ).toBeInTheDocument();
  });

  it('leaves the chip out when the banner shows the city', () => {
    setup({ showLocation: false });
    expect(screen.queryByRole('button', { name: /Change trip location/ })).toBeNull();
  });
});
