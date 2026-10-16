import type { KeyValueStore } from '@cellar/core';
import { describe, expect, it, vi } from 'vitest';
import { WikimediaCityPhotos } from '../src/adapters/wikimediaCityPhotos';
import imageInfo from '../e2e/fixtures/wikimedia-imageinfo.json';
import imagesKyoto from '../e2e/fixtures/wikimedia-images-kyoto.json';
import searchKyoto from '../e2e/fixtures/wikimedia-search-kyoto.json';

const DAY = 86_400_000;
const T0 = Date.UTC(2027, 2, 1);

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const empty = { batchcomplete: '' };

type Pages = Record<string, { title: string }>;

/** Wikimedia as the fixtures describe it; imageinfo answers only for the requested titles. */
function wikimedia(overrides: { search?: unknown; images?: unknown } = {}) {
  return vi.fn((input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const q = url.searchParams;
    if (q.get('generator') === 'search') return ok(overrides.search ?? searchKyoto);
    if (q.get('generator') === 'images') return ok(overrides.images ?? imagesKyoto);
    if (q.get('prop') === 'imageinfo') {
      const wanted = new Set((q.get('titles') ?? '').split('|'));
      const pages = Object.fromEntries(
        Object.entries(imageInfo.query.pages as Pages).filter(([, p]) => wanted.has(p.title)),
      );
      return ok({ query: { pages } });
    }
    return Promise.reject(new Error(`unexpected request ${url}`));
  });
}

function setup(fetchFn = wikimedia(), now = T0) {
  const store = memoryStore();
  const clock = { now };
  const service = new WikimediaCityPhotos(store, { fetchFn, now: () => clock.now });
  return { service, store, fetchFn, clock };
}

const urlsOf = (fetchFn: ReturnType<typeof wikimedia>) =>
  fetchFn.mock.calls.map(([u]) => new URL(String(u)));

describe('lead', () => {
  it('finds the article, its lead image, and the credit', async () => {
    const { service, fetchFn } = setup();
    const photo = await service.lead('Kyoto, Japan');
    expect(photo).toEqual({
      file: 'Kyoto_A.jpg',
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Kyoto_A.jpg/1280px-Kyoto_A.jpg',
      width: 1280,
      height: 720,
      credit: 'Jane Doe',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kyoto_A.jpg',
    });

    const [search, info] = urlsOf(fetchFn);
    expect(search!.origin + search!.pathname).toBe('https://en.wikipedia.org/w/api.php');
    expect(search!.searchParams.get('origin')).toBe('*');
    expect(search!.searchParams.get('action')).toBe('query');
    expect(search!.searchParams.get('generator')).toBe('search');
    expect(search!.searchParams.get('gsrsearch')).toBe('Kyoto, Japan');
    expect(search!.searchParams.get('gsrlimit')).toBe('1');
    expect(search!.searchParams.get('prop')).toBe('pageimages');
    expect(search!.searchParams.get('piprop')).toBe('name');
    expect(info!.origin + info!.pathname).toBe('https://commons.wikimedia.org/w/api.php');
    expect(info!.searchParams.get('origin')).toBe('*');
    expect(info!.searchParams.get('titles')).toBe('File:Kyoto_A.jpg');
    expect(info!.searchParams.get('prop')).toBe('imageinfo');
    expect(info!.searchParams.get('iiprop')).toBe('url|extmetadata|size');
    expect(info!.searchParams.get('iiurlwidth')).toBe('1280');
    for (const [, init] of fetchFn.mock.calls as unknown as [unknown, RequestInit][]) {
      expect(init.headers).toMatchObject({ 'Api-User-Agent': 'Cellar/1.0' });
    }
  });

  it('strips the Artist markup and says Unknown when there is none', async () => {
    const page = (artist: unknown) => ({
      query: {
        pages: {
          '1': {
            title: 'File:Kyoto_A.jpg',
            imageinfo: [
              {
                thumburl: 'https://upload.wikimedia.org/x.jpg',
                thumbwidth: 1280,
                thumbheight: 720,
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Kyoto_A.jpg',
                extmetadata: {
                  ...(artist === undefined ? {} : { Artist: { value: artist } }),
                  LicenseShortName: { value: 'CC0' },
                },
              },
            ],
          },
        },
      },
    });
    const run = async (artist: unknown) => {
      const fetchFn = vi.fn((input: string | URL | Request) =>
        String(input).includes('generator=search') ? ok(searchKyoto) : ok(page(artist)),
      );
      return (await setup(fetchFn as never).service.lead('Kyoto, Japan'))!.credit;
    };
    expect(await run('<span>Jane &amp; <b>John</b> Doe</span>')).toBe('Jane & John Doe');
    expect(await run(undefined)).toBe('Unknown');
    expect(await run('<a href="x"></a> ')).toBe('Unknown');
  });

  it('is null when the search finds nothing or the page has no image', async () => {
    expect(await setup(wikimedia({ search: empty })).service.lead('Nowhere')).toBeNull();
    const noImage = { query: { pages: { '1': { pageid: 1, title: 'Kyoto' } } } };
    expect(await setup(wikimedia({ search: noImage })).service.lead('Kyoto, Japan')).toBeNull();
  });

  it('is null when Commons has no information for the file', async () => {
    const fetchFn = vi.fn((input: string | URL | Request) =>
      String(input).includes('generator=search') ? ok(searchKyoto) : ok(empty),
    );
    expect(await setup(fetchFn as never).service.lead('Kyoto, Japan')).toBeNull();
  });

  it('rejects on a failed request', async () => {
    const down = vi.fn(() => Promise.resolve(new Response('no', { status: 503 })));
    await expect(setup(down as never).service.lead('Kyoto, Japan')).rejects.toThrow();
    const offline = vi.fn(() => Promise.reject(new TypeError('offline')));
    await expect(setup(offline as never).service.lead('Kyoto, Japan')).rejects.toThrow();
  });

  it('caches for 7 days and then fetches again', async () => {
    const { service, store, fetchFn, clock } = setup();
    const first = await service.lead('Kyoto, Japan');
    const calls = fetchFn.mock.calls.length;
    expect(store.map.has('cellar.cityPhoto.lead.Kyoto, Japan')).toBe(true);

    clock.now = T0 + 7 * DAY - 1;
    expect(await service.lead('Kyoto, Japan')).toEqual(first);
    expect(fetchFn.mock.calls.length).toBe(calls);

    clock.now = T0 + 7 * DAY + 1;
    expect(await service.lead('Kyoto, Japan')).toEqual(first);
    expect(fetchFn.mock.calls.length).toBeGreaterThan(calls);
  });

  it('caches "no photo" too, but never a failure', async () => {
    const empties = setup(wikimedia({ search: empty }));
    await empties.service.lead('Nowhere');
    await empties.service.lead('Nowhere');
    expect(empties.fetchFn).toHaveBeenCalledTimes(1);

    const down = vi.fn(() => Promise.resolve(new Response('no', { status: 503 })));
    const failing = setup(down as never);
    await expect(failing.service.lead('Kyoto, Japan')).rejects.toThrow();
    expect(failing.store.map.size).toBe(0);
  });

  it('ignores a damaged cache entry', async () => {
    const { service, store } = setup();
    store.set('cellar.cityPhoto.lead.Kyoto, Japan', '{not json');
    expect((await service.lead('Kyoto, Japan'))?.file).toBe('Kyoto_A.jpg');
  });

  it('shares one request between callers asking at the same time', async () => {
    const { service, fetchFn } = setup();
    await Promise.all([service.lead('Kyoto, Japan'), service.lead('Kyoto, Japan')]);
    expect(fetchFn).toHaveBeenCalledTimes(2); // one search, one imageinfo
  });
});

describe('more', () => {
  it('returns at most the limit, lead first, without maps, flags or non-photos', async () => {
    const { service, fetchFn } = setup();
    const photos = await service.more('Kyoto, Japan', 6);
    expect(photos.map((p) => p.file)).toEqual([
      'Kyoto_A.jpg',
      'Kyoto_B.jpg',
      'Kyoto_C.jpg',
      'Kyoto_D.jpg',
      'Kyoto_E.jpg',
      'Kyoto_F.jpg',
    ]);
    expect(photos[0]).toMatchObject({ credit: 'Jane Doe', license: 'CC BY-SA 4.0' });

    const images = urlsOf(fetchFn).find((u) => u.searchParams.get('generator') === 'images')!;
    expect(images.origin + images.pathname).toBe('https://en.wikipedia.org/w/api.php');
    expect(images.searchParams.get('titles')).toBe('Kyoto');
    expect(images.searchParams.get('gimlimit')).toBe('50');
    const info = urlsOf(fetchFn).filter((u) => u.searchParams.get('prop') === 'imageinfo');
    const asked = info.flatMap((u) => u.searchParams.get('titles')!.split('|'));
    expect(asked.join('|')).not.toMatch(/svg|Flag|map/i);

    expect((await setup().service.more('Kyoto, Japan', 3)).map((p) => p.file)).toEqual([
      'Kyoto_A.jpg',
      'Kyoto_B.jpg',
      'Kyoto_C.jpg',
    ]);
  });

  it('skips portrait and narrow images and names that look like logos or seals', async () => {
    const files = [
      'Kyoto_A.jpg',
      'Seal_of_Kyoto.jpg',
      'Kyoto_logo.jpg',
      'Coat_of_arms.jpg',
      'Locator.jpg',
      'Kyoto_B.jpg',
      'Kyoto_C.jpg',
      'Kyoto_D.jpg',
    ];
    const images = {
      query: {
        pages: Object.fromEntries(files.map((f, i) => [String(i), { title: `File:${f}` }])),
      },
    };
    const info = (title: string, w: number, h: number, width = 4000) => ({
      title,
      imageinfo: [
        {
          thumburl: `https://upload.wikimedia.org/${title}`,
          thumbwidth: w,
          thumbheight: h,
          width,
          height: 3000,
          descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
          extmetadata: {},
        },
      ],
    });
    const pages = {
      '1': info('File:Kyoto_A.jpg', 1280, 720),
      '2': info('File:Kyoto_B.jpg', 720, 1280), // portrait
      '3': info('File:Kyoto_C.jpg', 800, 450, 800), // too small
      '4': info('File:Kyoto_D.jpg', 1280, 853),
    };
    const fetchFn = vi.fn((input: string | URL | Request) => {
      const q = new URL(String(input)).searchParams;
      if (q.get('generator') === 'search') return ok(searchKyoto);
      if (q.get('generator') === 'images') return ok(images);
      return ok({ query: { pages } });
    });
    const photos = await setup(fetchFn as never).service.more('Kyoto, Japan', 6);
    expect(photos.map((p) => p.file)).toEqual(['Kyoto_A.jpg', 'Kyoto_D.jpg']);
    expect(photos[0]!.credit).toBe('Unknown');
  });

  it('is empty when the city has no article, and rejects on failure', async () => {
    expect(await setup(wikimedia({ search: empty })).service.more('Nowhere', 6)).toEqual([]);
    const down = vi.fn(() => Promise.resolve(new Response('no', { status: 503 })));
    await expect(setup(down as never).service.more('Kyoto, Japan', 6)).rejects.toThrow();
  });

  it('caches for 7 days under its own key', async () => {
    const { service, store, fetchFn, clock } = setup();
    const first = await service.more('Kyoto, Japan', 6);
    const calls = fetchFn.mock.calls.length;
    expect(store.map.has('cellar.cityPhoto.more.Kyoto, Japan')).toBe(true);

    clock.now = T0 + 7 * DAY - 1;
    expect(await service.more('Kyoto, Japan', 6)).toEqual(first);
    expect(fetchFn.mock.calls.length).toBe(calls);
    expect((await service.more('Kyoto, Japan', 2)).map((p) => p.file)).toEqual([
      'Kyoto_A.jpg',
      'Kyoto_B.jpg',
    ]);

    clock.now = T0 + 7 * DAY + 1;
    await service.more('Kyoto, Japan', 6);
    expect(fetchFn.mock.calls.length).toBeGreaterThan(calls);
  });
});

describe('byFile', () => {
  it('returns the named photo with its credit', async () => {
    const { service, fetchFn } = setup();
    const photo = await service.byFile('Kyoto_C.jpg');
    expect(photo).toMatchObject({
      file: 'Kyoto_C.jpg',
      credit: 'Jane Doe',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kyoto_C.jpg',
    });
    expect(urlsOf(fetchFn)[0]!.searchParams.get('titles')).toBe('File:Kyoto_C.jpg');
  });

  it('is null when the file is gone, and rejects on failure', async () => {
    expect(await setup().service.byFile('Missing.jpg')).toBeNull();
    const down = vi.fn(() => Promise.resolve(new Response('no', { status: 503 })));
    await expect(setup(down as never).service.byFile('Kyoto_C.jpg')).rejects.toThrow();
  });
});
