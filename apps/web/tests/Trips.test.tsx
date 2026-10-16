import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTrip,
  setTripCoverPhoto,
  setTripLocation,
  type Change,
  type Location,
  type Trip,
  type TripRepository,
} from '@cellar/core';
import { Trips } from '../src/pages/Trips';
import { cityPhoto, fakeCityPhotos, withServices } from './setup';

const kyoto: Location = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };

function makeTrip(
  name: string,
  start: string,
  end: string,
  location: Location | null,
  cover?: string,
) {
  const created = createTrip('u', name, start, end);
  if (!created.ok) throw new Error('fixture');
  let state = created.state;
  if (location) {
    const r = setTripLocation(location)(state);
    if (!r.ok) throw new Error('fixture');
    state = r.state;
  }
  if (cover) {
    const r = setTripCoverPhoto(cover)(state);
    if (!r.ok) throw new Error('fixture');
    state = r.state;
  }
  return state.trip;
}

function setup(trips: Trip[], cityPhotos = fakeCityPhotos()) {
  const save = vi.fn<(changes: Change[]) => Promise<void>>(async () => {});
  const repo = {
    listTrips: vi.fn(async () => trips),
    listDeletedTrips: vi.fn(async () => []),
    save,
  } as unknown as TripRepository;
  render(
    <MemoryRouter>
      <Trips />
    </MemoryRouter>,
    { wrapper: withServices({ repo, cityPhotos }) },
  );
  return { save, cityPhotos, user: userEvent.setup() };
}

/** The card (list item) of the trip whose link is named like `name`. */
async function card(name: string): Promise<HTMLElement> {
  const link = await screen.findByRole('link', { name: new RegExp(name) });
  return link.closest('li')!;
}

// Tokyo is already on March 29 at this moment, 12 days before the Kyoto trip below.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-03-29T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('Your trips: card photos', () => {
  it('shows the city photo, its credit and the status pill, and still links to the trip', async () => {
    const trip = makeTrip('Kyoto trip', '2027-04-10', '2027-04-14', kyoto);
    const { cityPhotos } = setup([trip]);
    const kyotoCard = await card('Kyoto trip');
    const img = await within(kyotoCard).findByRole('img', { name: 'Kyoto, Japan' });
    expect(img).toHaveAttribute('src', 'https://photos.test/city/Kyoto_A.jpg');
    expect(cityPhotos.lead).toHaveBeenCalledWith('Kyoto, Japan');
    expect(within(kyotoCard).getByText('In 12 days')).toBeInTheDocument();
    expect(
      within(kyotoCard).getByRole('link', { name: 'Photo: Jane Doe · CC BY-SA 4.0' }),
    ).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Kyoto_A.jpg');
    expect(within(kyotoCard).getByRole('link', { name: /Kyoto trip/ })).toHaveAttribute(
      'href',
      `/trips/${trip.id}`,
    );
  });

  it('shows Day N of M during the trip and Ended after it', async () => {
    setup([
      makeTrip('Now trip', '2027-03-28', '2027-04-01', kyoto),
      makeTrip('Old trip', '2027-03-01', '2027-03-05', kyoto),
    ]);
    expect(within(await card('Now trip')).getByText('Day 2 of 5')).toBeInTheDocument();
    expect(within(await card('Old trip')).getByText('Ended')).toBeInTheDocument();
  });

  it('uses the chosen cover photo when the trip has one', async () => {
    const trip = makeTrip('Kyoto trip', '2027-04-10', '2027-04-14', kyoto, 'Kyoto_B.jpg');
    const { cityPhotos } = setup([trip]);
    const img = await screen.findByRole('img', { name: 'Kyoto, Japan' });
    expect(img).toHaveAttribute('src', 'https://photos.test/city/Kyoto_B.jpg');
    expect(cityPhotos.byFile).toHaveBeenCalledWith('Kyoto_B.jpg');
  });

  it('shows a placeholder and asks for a location when the trip has none', async () => {
    const { cityPhotos } = setup([makeTrip('Somewhere', '2027-04-10', '2027-04-14', null)]);
    const somewhereCard = await card('Somewhere');
    expect(
      within(somewhereCard).getByText('Set a location to get a cover photo'),
    ).toBeInTheDocument();
    expect(within(somewhereCard).queryByRole('img')).toBeNull();
    expect(within(somewhereCard).getByRole('link', { name: /Somewhere/ })).toBeInTheDocument();
    expect(cityPhotos.lead).not.toHaveBeenCalled();
  });

  it.each([
    ['the service fails', fakeCityPhotos({ fail: true })],
    ['the city has no photo', fakeCityPhotos({ photos: [] })],
  ])('shows a plain placeholder, without the location hint, when %s', async (_why, cityPhotos) => {
    const trip = makeTrip('Kyoto trip', '2027-04-10', '2027-04-14', kyoto);
    setup([trip], cityPhotos);
    const kyotoCard = await card('Kyoto trip');
    await waitFor(() => expect(cityPhotos.lead).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(within(kyotoCard).queryByRole('img', { name: 'Kyoto, Japan' })).toBeNull();
    expect(within(kyotoCard).queryByText('Set a location to get a cover photo')).toBeNull();
    expect(within(kyotoCard).getByText('In 12 days')).toBeInTheDocument();
    expect(within(kyotoCard).getByRole('link', { name: /Kyoto trip/ })).toBeInTheDocument();
  });
});

describe('Your trips: change cover photo', () => {
  async function openPicker(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Actions for Kyoto trip' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change cover photo' }));
    return screen.findByRole('dialog', { name: 'Change cover photo' });
  }

  it('is offered only for trips with a location', async () => {
    const { user } = setup([makeTrip('Somewhere', '2027-04-10', '2027-04-14', null)]);
    await user.click(await screen.findByRole('button', { name: 'Actions for Somewhere' }));
    expect(await screen.findByRole('menuitem', { name: 'Rename Somewhere' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Change cover photo' })).toBeNull();
  });

  it('saves the picked photo with the trip and offers Undo', async () => {
    const trip = makeTrip('Kyoto trip', '2027-04-10', '2027-04-14', kyoto);
    const { save, user } = setup([trip]);
    const dialog = await openPicker(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Photo 2 by Jane Doe' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]![0]).toEqual([
      expect.objectContaining({
        table: 'trips',
        op: 'upsert',
        row: expect.objectContaining({ id: trip.id, coverPhoto: 'Kyoto_B.jpg' }),
      }),
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByRole('img', { name: 'Kyoto, Japan' })).toHaveAttribute(
      'src',
      'https://photos.test/city/Kyoto_B.jpg',
    );

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]![0]).toEqual([
      expect.objectContaining({ row: expect.objectContaining({ coverPhoto: null }) }),
    ]);
  });

  it('"Use automatic photo" clears the choice', async () => {
    const trip = makeTrip('Kyoto trip', '2027-04-10', '2027-04-14', kyoto, 'Kyoto_B.jpg');
    const { save, user } = setup(
      [trip],
      fakeCityPhotos({ photos: [cityPhoto('Kyoto_A.jpg'), cityPhoto('Kyoto_B.jpg')] }),
    );
    const dialog = await openPicker(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Use automatic photo' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ row: expect.objectContaining({ coverPhoto: null }) }),
    ]);
  });

  it('says so when saving fails and keeps the card as it was', async () => {
    const trip = makeTrip('Kyoto trip', '2027-04-10', '2027-04-14', kyoto);
    const { save, user } = setup([trip]);
    save.mockRejectedValueOnce(new Error('offline'));
    const dialog = await openPicker(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Photo 2 by Jane Doe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.getByRole('img', { name: 'Kyoto, Japan' })).toHaveAttribute(
      'src',
      'https://photos.test/city/Kyoto_A.jpg',
    );
  });
});
