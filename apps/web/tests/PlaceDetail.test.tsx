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
import {
  PlaceDetail,
  linkedSubject,
  popularSubject,
  type PlaceSubject,
} from '../src/components/list/PlaceDetail';
import { Button } from '../src/components/ui/Button';
import {
  chelseaInfo,
  chelseaPlace,
  fakePlaceSearch,
  metPopular,
  popularPlace,
  withServices,
} from './setup';

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
      subject={popularSubject(opts.place ?? metPopular)}
      type="activity"
      actions={
        <>
          <Button variant="primary" onClick={handlers.onPlace}>
            Place in a block
          </Button>
          <Button onClick={handlers.onAddToList}>Add to my list</Button>
        </>
      }
      onClose={handlers.onClose}
    />,
    { wrapper: withServices({ places, store }) },
  );
  return { places, ...handlers, user: userEvent.setup(), store };
}

function setupLinked(
  opts: {
    subject?: PlaceSubject;
    state?: TripState;
    places?: ReturnType<typeof fakePlaceSearch>;
  } = {},
) {
  const places = opts.places ?? fakePlaceSearch();
  const onPlace = vi.fn();
  const onClose = vi.fn();
  render(
    <PlaceDetail
      state={opts.state ?? empty}
      subject={opts.subject ?? linkedSubject(chelseaPlace)}
      type="food"
      actions={<Button onClick={onPlace}>Place in a block</Button>}
      onClose={onClose}
    />,
    { wrapper: withServices({ places }) },
  );
  return { places, onPlace, onClose, user: userEvent.setup() };
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

describe('PlaceDetail for a linked place', () => {
  it('shows the stored facts at once, with a loading status, then the fetched details', async () => {
    const { places } = setupLinked();
    const dialog = screen.getByRole('dialog', { name: 'Chelsea Market' });
    expect(within(dialog).getByText('75 9th Ave, New York')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Open in maps' })).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('Loading details…');

    expect(await within(dialog).findByText('Market · 75 9th Ave, New York')).toBeInTheDocument();
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(places.info).toHaveBeenCalledWith('test-chelsea');
    expect(within(dialog).getByText('4.6 (31,204 reviews)')).toBeInTheDocument();
    expect(await within(dialog).findByRole('img', { name: 'Chelsea Market' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Photo: Ann Lee' })).toBeInTheDocument();
  });

  it("shows today's hours in the viewer's locale and the week on request", async () => {
    const { user } = setupLinked();
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText(/^Open today 9:00\sAM–9:00\sPM$/)).toBeInTheDocument();
    const toggle = within(dialog).getByRole('button', { name: 'Show week' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).queryByRole('list', { name: 'Opening hours' })).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const week = within(dialog).getByRole('list', { name: 'Opening hours' });
    const lines = within(week).getAllByRole('listitem');
    expect(lines).toHaveLength(7);
    expect(lines[0]).toHaveTextContent('Monday');
    expect(lines[6]).toHaveTextContent('Sunday');
    expect(within(week).getAllByText('Today')).toHaveLength(1);
    expect(lines[0]).toHaveTextContent(/9:00\sAM–9:00\sPM/);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the place-local day as Today (Tokyo, already tomorrow)', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-04-02T16:00:00Z') });
    try {
      const places = fakePlaceSearch({
        info: (placeId) => ({ ...chelseaInfo, placeId, utcOffsetMinutes: 540 }),
      });
      const { user } = setupLinked({ places });
      await user.click(await screen.findByRole('button', { name: 'Show week' }));
      const lines = within(screen.getByRole('list', { name: 'Opening hours' })).getAllByRole(
        'listitem',
      );
      expect(lines[5]).toHaveTextContent('Saturday');
      expect(lines[5]).toHaveTextContent('Today');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a Website link that opens in a new tab', async () => {
    setupLinked();
    const link = await screen.findByRole('link', { name: 'Website' });
    expect(link).toHaveAttribute('href', 'https://chelseamarket.com/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('leaves out hours and website when the provider has none', async () => {
    const places = fakePlaceSearch({
      info: (placeId) => ({ ...chelseaInfo, placeId, hours: null, website: null }),
    });
    setupLinked({ places });
    await screen.findByText('4.6 (31,204 reviews)');
    expect(screen.queryByText(/Open today|Closed today|Open 24 hours/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show week' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Website' })).toBeNull();
  });

  it('reads Closed today and Open 24 hours', async () => {
    const closed = fakePlaceSearch({
      info: (placeId) => ({
        ...chelseaInfo,
        placeId,
        utcOffsetMinutes: null,
        hours: { periods: [] },
      }),
    });
    const first = render(
      <PlaceDetail
        state={empty}
        subject={linkedSubject(chelseaPlace)}
        type="food"
        actions={null}
        onClose={() => {}}
      />,
      { wrapper: withServices({ places: closed }) },
    );
    expect(await screen.findByText('Closed today')).toBeInTheDocument();
    first.unmount();

    const always = fakePlaceSearch({
      info: (placeId) => ({
        ...chelseaInfo,
        placeId: `${placeId}-24`,
        hours: { periods: [{ open: { day: 0, hour: 0, minute: 0 }, close: null }] },
      }),
    });
    render(
      <PlaceDetail
        state={empty}
        subject={linkedSubject({ ...chelseaPlace, id: 'other' })}
        type="food"
        actions={null}
        onClose={() => {}}
      />,
      { wrapper: withServices({ places: always }) },
    );
    expect(await screen.findByText('Open 24 hours')).toBeInTheDocument();
  });

  it('shows hours and website on a Popular place too, keeping its own rating', async () => {
    setup();
    expect(await screen.findByText(/^Open today/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Website' })).toBeInTheDocument();
    expect(screen.getByText('4.8 (104,512 reviews)')).toBeInTheDocument();
  });

  it('shows the actions it is given, plus Open in maps, and the planned dates', async () => {
    const { user, onPlace } = setupLinked({ state: planned() });
    expect(screen.queryByText(/^Planned:/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Place in a block' }));
    expect(onPlace).toHaveBeenCalledTimes(1);
  });
});

describe('PlaceDetail when details are unavailable', () => {
  it('keeps the stored facts, the icon and the actions with an unavailable note', async () => {
    const places = fakePlaceSearch({ infoFail: true });
    const { onClose, user } = setupLinked({ places });
    const dialog = screen.getByRole('dialog', { name: 'Chelsea Market' });
    expect(
      await within(dialog).findByText("More details aren't available right now."),
    ).toBeVisible();
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(within(dialog).getByText('75 9th Ave, New York')).toBeInTheDocument();
    expect(within(dialog).getByTestId('place-photo-placeholder')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Open in maps' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Place in a block' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('says the place may no longer be listed when the provider does not know it', async () => {
    const places = fakePlaceSearch({ infoNotFound: true });
    setupLinked({ places });
    expect(await screen.findByText('This place may no longer be listed.')).toBeInTheDocument();
    expect(screen.getByText('75 9th Ave, New York')).toBeInTheDocument();
  });
});
