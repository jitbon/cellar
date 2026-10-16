import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTrip,
  setTripBannerPhoto,
  setTripCoverPhoto,
  setTripLocation,
  type Command,
  type KeyValueStore,
  type TripState,
} from '@cellar/core';
import userEvent from '@testing-library/user-event';
import { CityBanner } from '../src/components/layout/CityBanner';
import { fakeCityPhotos, withServices } from './setup';

const kyoto = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };

function stateOf(located: boolean): TripState {
  const created = createTrip('u', 'Japan', '2027-04-10', '2027-04-14');
  if (!created.ok) throw new Error('fixture');
  if (!located) return created.state;
  const r = setTripLocation(kyoto)(created.state);
  if (!r.ok) throw new Error('fixture');
  return r.state;
}

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

function setup(
  state: TripState,
  opts: {
    store?: KeyValueStore;
    cityPhotos?: ReturnType<typeof fakeCityPhotos>;
    onChangePhoto?: () => void;
    onEditLocation?: () => void;
  } = {},
) {
  const cityPhotos = opts.cityPhotos ?? fakeCityPhotos();
  const store = opts.store ?? memoryStore();
  render(
    <CityBanner
      state={state}
      onChangePhoto={opts.onChangePhoto}
      onEditLocation={opts.onEditLocation}
    />,
    {
      wrapper: withServices({ cityPhotos, store }),
    },
  );
  return { cityPhotos };
}

function apply(state: TripState, command: Command): TripState {
  const r = command(state);
  if (!r.ok) throw new Error('fixture');
  return r.state;
}

const bannerImage = async () => {
  const banner = await screen.findByTestId('city-banner');
  await waitFor(() => expect(banner.querySelector('img')).not.toBeNull());
  return banner.querySelector('img')!;
};

// 12 days before the trip starts, in the trip's own time zone.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2027-03-29T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('CityBanner photo choice (separate from the trip card)', () => {
  it('ignores the card cover and shows the automatic photo', async () => {
    setup(apply(stateOf(true), setTripCoverPhoto('Kyoto_B.jpg')));
    expect(await bannerImage()).toHaveAttribute('src', 'https://photos.test/city/Kyoto_A.jpg');
  });

  it('shows its own chosen banner photo', async () => {
    const state = apply(
      apply(stateOf(true), setTripCoverPhoto('Kyoto_B.jpg')),
      setTripBannerPhoto('Kyoto_C.jpg'),
    );
    setup(state);
    expect(await bannerImage()).toHaveAttribute('src', 'https://photos.test/city/Kyoto_C.jpg');
  });

  it('has a "Change banner photo" button', async () => {
    vi.useRealTimers();
    const onChangePhoto = vi.fn();
    setup(stateOf(true), { onChangePhoto });
    await bannerImage();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Change banner photo' }));
    expect(onChangePhoto).toHaveBeenCalledTimes(1);
  });
});

describe('CityBanner', () => {
  it('shows the photo, city, progress text and credit for a located trip', async () => {
    setup(stateOf(true));
    const banner = await screen.findByTestId('city-banner');
    await waitFor(() => expect(banner.querySelector('img')).not.toBeNull());
    expect(banner.querySelector('img')).toHaveAttribute(
      'src',
      'https://photos.test/city/Kyoto_A.jpg',
    );
    expect(banner).toHaveTextContent('Kyoto, Japan');
    expect(banner).toHaveTextContent('In 12 days');
    expect(screen.getByRole('link', { name: 'Photo: Jane Doe · CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://commons.wikimedia.org/wiki/File:Kyoto_A.jpg',
    );
  });

  it('uses the banner photo when one was chosen', async () => {
    const state = stateOf(true);
    setup({ ...state, trip: { ...state.trip, bannerPhoto: 'Kyoto_B.jpg' } });
    const banner = await screen.findByTestId('city-banner');
    await waitFor(() => expect(banner.querySelector('img')).not.toBeNull());
    expect(banner.querySelector('img')).toHaveAttribute(
      'src',
      'https://photos.test/city/Kyoto_B.jpg',
    );
  });

  it('shows nothing, and asks for nothing, without a location', () => {
    const { cityPhotos } = setup(stateOf(false));
    expect(screen.queryByTestId('city-banner')).toBeNull();
    expect(cityPhotos.lead).not.toHaveBeenCalled();
  });

  it.each([
    ['the city has no photo', fakeCityPhotos({ photos: [] })],
    ['the photo service fails', fakeCityPhotos({ fail: true })],
  ])('goes away when %s', async (_why, cityPhotos) => {
    setup(stateOf(true), { cityPhotos });
    await waitFor(() => expect(cityPhotos.lead).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('city-banner')).toBeNull());
  });

  it('is hidden, and asks for nothing, when the device preference says so', () => {
    const store = memoryStore({ 'cellar.banner.hidden': '1' });
    const { cityPhotos } = setup(stateOf(true), { store });
    expect(screen.queryByTestId('city-banner')).toBeNull();
    expect(cityPhotos.lead).not.toHaveBeenCalled();
  });
});

describe('CityBanner city name', () => {
  it('is the button that changes the trip location', async () => {
    vi.useRealTimers();
    const onEditLocation = vi.fn();
    setup(stateOf(true), { onEditLocation });
    await bannerImage();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Change trip location (Kyoto, Japan)' }));
    expect(onEditLocation).toHaveBeenCalledTimes(1);
  });
});

describe('CityBanner while the photo loads', () => {
  it('already shows the city button and progress, without credit or photo', async () => {
    const cityPhotos = fakeCityPhotos();
    cityPhotos.lead.mockReturnValue(new Promise(() => {}));
    const onEditLocation = vi.fn();
    setup(stateOf(true), { cityPhotos, onEditLocation });
    const banner = await screen.findByTestId('city-banner');
    expect(
      screen.getByRole('button', { name: 'Change trip location (Kyoto, Japan)' }),
    ).toBeInTheDocument();
    expect(banner).toHaveTextContent('In 12 days');
    expect(banner.querySelector('img')).toBeNull();
    expect(screen.queryByRole('link', { name: /^Photo:/ })).toBeNull();
  });
});
