import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapLinks, type KeyValueStore } from '@cellar/core';
import { OpenInMapsItems } from '../src/components/places/OpenInMapsItems';
import { Menu } from '../src/components/ui/Menu';
import { chelseaPlace, withServices } from './setup';

function fakeStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    get: (k) => data[k] ?? null,
    set: (k, v) => void (data[k] = v),
    remove: (k) => void delete data[k],
  };
}

function setup(store: KeyValueStore) {
  render(
    <Menu trigger={<button type="button">Menu</button>}>
      <OpenInMapsItems place={chelseaPlace} />
    </Menu>,
    { wrapper: withServices({ store }) },
  );
  return userEvent.setup();
}

afterEach(() => vi.restoreAllMocks());

describe('OpenInMapsItems', () => {
  it('lists the three apps under an "Open in maps" label, Google first by default', async () => {
    const user = setup(fakeStore());
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText('Open in maps')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Google Maps',
      'Apple Maps',
      'Waze',
    ]);
  });

  it('lists the stored choice first and ignores an unknown stored value', async () => {
    const user = setup(fakeStore({ 'cellar.mapApp': 'waze' }));
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Waze',
      'Google Maps',
      'Apple Maps',
    ]);
  });

  it('ignores an unknown stored value', async () => {
    const user = setup(fakeStore({ 'cellar.mapApp': 'bing' }));
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getAllByRole('menuitem')[0]).toHaveTextContent('Google Maps');
  });

  it('opens the link in a new tab and remembers the choice', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const store = fakeStore();
    const user = setup(store);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Apple Maps' }));
    expect(open).toHaveBeenCalledWith(
      mapLinks(chelseaPlace).apple,
      '_blank',
      'noopener,noreferrer',
    );
    expect(store.data['cellar.mapApp']).toBe('apple');
  });
});
