import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlacePhotoRef } from '@cellar/core';
import { usePlacePhoto } from '../src/state/usePlacePhoto';
import { fakePlaceSearch, withPlaces } from './setup';

interface FakeObserver {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnected: boolean;
}
let observers: FakeObserver[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly self: FakeObserver;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.self = { callback, options, observed: [], disconnected: false };
        observers.push(this.self);
      }
      observe(el: Element) {
        this.self.observed.push(el);
      }
      unobserve() {}
      disconnect() {
        this.self.disconnected = true;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Tells every live observer that its element scrolled into view. */
function scrollIntoView() {
  act(() => {
    for (const o of observers.filter((x) => !x.disconnected)) {
      o.callback(
        o.observed.map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry),
        {} as IntersectionObserver,
      );
    }
  });
}

const ref = (name: string): PlacePhotoRef => ({ name, author: 'Ann Lee', authorUri: null });

function Probe({ photo, id = 'p' }: { photo: PlacePhotoRef | null; id?: string }) {
  const p = usePlacePhoto(photo, 160);
  return (
    <div ref={p.ref} data-testid={id}>
      {p.status}|{p.url ?? ''}
    </div>
  );
}

describe('usePlacePhoto', () => {
  it('does not ask for the photo until the element is in view, then asks once', async () => {
    const places = fakePlaceSearch();
    render(<Probe photo={ref('places/a/photos/1')} />, { wrapper: withPlaces(places) });
    expect(screen.getByTestId('p')).toHaveTextContent('idle|');
    expect(observers[0]!.options?.rootMargin).toBe('100px');
    expect(places.photoUrl).not.toHaveBeenCalled();

    scrollIntoView();
    await waitFor(() =>
      expect(screen.getByTestId('p')).toHaveTextContent(
        'ready|https://photos.test/places/a/photos/1?w=160',
      ),
    );
    expect(places.photoUrl).toHaveBeenCalledTimes(1);
    expect(places.photoUrl).toHaveBeenCalledWith('places/a/photos/1', 160);
  });

  it('reuses the session result for the same photo name', async () => {
    const places = fakePlaceSearch();
    const photo = ref('places/b/photos/1');
    const first = render(<Probe photo={photo} />, { wrapper: withPlaces(places) });
    scrollIntoView();
    await waitFor(() => expect(screen.getByTestId('p')).toHaveTextContent('ready'));
    first.unmount();

    render(<Probe photo={photo} id="again" />, { wrapper: withPlaces(places) });
    expect(screen.getByTestId('again')).toHaveTextContent('ready|https://photos.test/');
    scrollIntoView();
    expect(places.photoUrl).toHaveBeenCalledTimes(1);
  });

  it('shares one request between two cards showing the same photo at once', async () => {
    const places = fakePlaceSearch();
    const photo = ref('places/c/photos/1');
    render(
      <>
        <Probe photo={photo} id="one" />
        <Probe photo={photo} id="two" />
      </>,
      { wrapper: withPlaces(places) },
    );
    scrollIntoView();
    await waitFor(() => expect(screen.getByTestId('two')).toHaveTextContent('ready'));
    expect(places.photoUrl).toHaveBeenCalledTimes(1);
  });

  it('is none when the photo cannot be loaded, and does not retry', async () => {
    const places = fakePlaceSearch({ photoFail: true });
    const photo = ref('places/d/photos/1');
    const { unmount } = render(<Probe photo={photo} />, { wrapper: withPlaces(places) });
    scrollIntoView();
    await waitFor(() => expect(screen.getByTestId('p')).toHaveTextContent('none|'));
    unmount();
    render(<Probe photo={photo} />, { wrapper: withPlaces(places) });
    scrollIntoView();
    expect(screen.getByTestId('p')).toHaveTextContent('none|');
    expect(places.photoUrl).toHaveBeenCalledTimes(1);
  });

  it('never asks when the place has no photo', () => {
    const places = fakePlaceSearch();
    render(<Probe photo={null} />, { wrapper: withPlaces(places) });
    scrollIntoView();
    expect(screen.getByTestId('p')).toHaveTextContent('none|');
    expect(places.photoUrl).not.toHaveBeenCalled();
  });

  it('is none outside a services provider', () => {
    render(<Probe photo={ref('places/e/photos/1')} />);
    scrollIntoView();
    expect(screen.getByTestId('p')).toHaveTextContent('none|');
  });
});
