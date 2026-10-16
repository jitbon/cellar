import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createTrip,
  placePlace,
  popularToPlace,
  type PopularPlace,
  type TripState,
} from '@cellar/core';
import { PlaceDetail } from '../src/components/list/PlaceDetail';
import { fakePlaceSearch, metPopular, popularPlace, withServices } from './setup';

const created = createTrip('u', 'NYC', '2027-05-01', '2027-05-05');
if (!created.ok) throw new Error('fixture');
const empty: TripState = created.state;

function planned(): TripState {
  let state = empty;
  const morning = state.blocks.find((b) => b.name === 'Morning')!;
  const lunch = state.blocks.find((b) => b.name === 'Lunch')!;
  for (const [date, block] of [
    ['2027-05-04', lunch],
    ['2027-05-03', morning],
  ] as const) {
    const r = placePlace(popularToPlace(metPopular), 'activity', date, block.id)(state);
    if (!r.ok) throw new Error('fixture');
    state = r.state;
  }
  return state;
}

function setup(
  opts: {
    place?: PopularPlace;
    state?: TripState;
    places?: ReturnType<typeof fakePlaceSearch>;
  } = {},
) {
  const places = opts.places ?? fakePlaceSearch();
  const handlers = { onPlace: vi.fn(), onAddToList: vi.fn(), onClose: vi.fn() };
  const store = { get: () => null, set: vi.fn(), remove: vi.fn() };
  render(
    <PlaceDetail
      state={opts.state ?? empty}
      place={opts.place ?? metPopular}
      type="activity"
      {...handlers}
    />,
    { wrapper: withServices({ places, store }) },
  );
  return { places, ...handlers, user: userEvent.setup(), store };
}

describe('PlaceDetail', () => {
  it('is a dialog named after the place with a large photo, its credit, and the details', async () => {
    const { places } = setup();
    const dialog = screen.getByRole('dialog', { name: metPopular.name });
    const img = await within(dialog).findByRole('img', { name: metPopular.name });
    expect(img).toHaveAttribute('src', 'https://photos.test/places/test-met/photos/p1?w=800');
    expect(places.photoUrl).toHaveBeenCalledWith('places/test-met/photos/p1', 800);
    expect(within(dialog).getByRole('link', { name: 'Photo: Ann Lee' })).toHaveAttribute(
      'href',
      'https://maps.google.com/contrib/1',
    );
    expect(within(dialog).getByText('Museum · 1000 5th Ave, New York')).toBeInTheDocument();
    expect(within(dialog).getByText('4.8 (104,512 reviews)')).toBeInTheDocument();
  });

  it('lists where the place is planned, by date and block, or nothing when unplaced', () => {
    setup({ state: planned() });
    expect(screen.getByText('Planned: Mon May 3 · Morning')).toBeInTheDocument();
    expect(screen.getByText('Planned: Tue May 4 · Lunch')).toBeInTheDocument();
  });

  it('shows no "Planned" line when it is not on the schedule', () => {
    setup();
    expect(screen.queryByText(/^Planned:/)).toBeNull();
  });

  it('shows a placeholder, and everything else, when the place has no photo or it fails', async () => {
    const noPhoto = popularPlace('test-nophoto', 'Quiet Spot', ['park'], 'Park', null);
    setup({ place: noPhoto });
    expect(screen.queryByRole('img', { name: 'Quiet Spot' })).toBeNull();
    expect(screen.getByTestId('place-photo-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Photo:/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Place in a block' })).toBeInTheDocument();
  });

  it('falls back to the placeholder when the photo service fails', async () => {
    const places = fakePlaceSearch({ photoFail: true });
    setup({ places });
    await waitFor(() => expect(places.photoUrl).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('place-photo-placeholder')).toBeInTheDocument());
    expect(screen.queryByRole('img', { name: metPopular.name })).toBeNull();
  });

  it('has the three actions, calling the same handlers as the card menu', async () => {
    const { onPlace, onAddToList, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Place in a block' }));
    expect(onPlace).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Add to my list' }));
    expect(onAddToList).toHaveBeenCalledTimes(1);

    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await user.click(screen.getByRole('button', { name: 'Open in maps' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Google Maps' }));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('google.com/maps'),
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
  });

  it('closes with the X and with a click on the backdrop', async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
