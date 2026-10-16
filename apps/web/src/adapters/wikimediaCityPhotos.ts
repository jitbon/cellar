import type { CityPhoto, CityPhotoService, KeyValueStore } from '@cellar/core';

const WIKIPEDIA = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const IMAGE_WIDTH = 1280;
const MIN_ORIGINAL_WIDTH = 1000;
const ARTICLE_IMAGES = 50;
const CACHE_MS = 7 * 86_400_000;
// Names that are almost never a photo of the city itself.
const NOT_A_PHOTO = /map|flag|logo|seal|coat|locator|\.svg$/i;
const PHOTO_FILE = /\.(jpe?g|png)$/i;

interface WikiPage {
  title?: string;
  pageimage?: string;
  imageinfo?: {
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    width?: number;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
}

interface WikiResponse {
  query?: { pages?: Record<string, WikiPage> };
}

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

/** Markup and entities out of Commons' Artist field, which is HTML. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const fileOf = (title: string) => title.replace(/^File:/, '');

/**
 * City photos from Wikipedia and Wikimedia Commons: free, keyless and openly licensed, so the
 * lookups are cached per device for 7 days (research R1). The credit comes from Commons.
 */
export class WikimediaCityPhotos implements CityPhotoService {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;

  constructor(
    private readonly store: KeyValueStore,
    opts: { fetchFn?: typeof fetch; now?: () => number } = {},
  ) {
    this.fetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
    this.now = opts.now ?? Date.now;
  }

  lead(cityName: string): Promise<CityPhoto | null> {
    return this.cached(`cellar.cityPhoto.lead.${cityName}`, async () => {
      const article = await this.article(cityName);
      if (!article?.pageimage) return null;
      return (await this.photosOf([article.pageimage], false)).get(article.pageimage) ?? null;
    });
  }

  async more(cityName: string, limit: number): Promise<CityPhoto[]> {
    const photos = await this.cached(`cellar.cityPhoto.more.${cityName}`, async () => {
      const article = await this.article(cityName);
      if (!article?.title) return [];
      const listed = await this.query(WIKIPEDIA, {
        generator: 'images',
        titles: article.title,
        gimlimit: String(ARTICLE_IMAGES),
      });
      const candidates = Object.values(listed.query?.pages ?? {})
        .map((p) => fileOf(p.title ?? ''))
        .filter((f) => PHOTO_FILE.test(f) && !NOT_A_PHOTO.test(f));
      const files = [
        ...new Set([...(article.pageimage ? [article.pageimage] : []), ...candidates]),
      ].slice(0, ARTICLE_IMAGES);
      const found = await this.photosOf(files);
      return files.flatMap((f) => {
        const photo = found.get(f);
        return photo && photo.width > photo.height ? [photo] : [];
      });
    });
    return photos.slice(0, limit);
  }

  async byFile(file: string): Promise<CityPhoto | null> {
    return (await this.photosOf([file], false)).get(file) ?? null;
  }

  /** The best-matching article for a place name, with its lead image file when it has one. */
  private async article(cityName: string): Promise<{ title: string; pageimage?: string } | null> {
    const data = await this.query(WIKIPEDIA, {
      generator: 'search',
      gsrsearch: cityName,
      gsrlimit: '1',
      prop: 'pageimages',
      piprop: 'name',
    });
    const page = Object.values(data.query?.pages ?? {})[0];
    return page?.title ? { title: page.title, pageimage: page.pageimage } : null;
  }

  /**
   * Image URL and credit for each file, by file name. With `strict`, files that are narrower than
   * 1000 px are left out (the cover picker wants sharp photos); a lead or chosen photo is kept.
   */
  private async photosOf(files: string[], strict = true): Promise<Map<string, CityPhoto>> {
    const out = new Map<string, CityPhoto>();
    if (files.length === 0) return out;
    const data = await this.query(COMMONS, {
      titles: files.map((f) => `File:${f}`).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size',
      iiurlwidth: String(IMAGE_WIDTH),
    });
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!page.title || !info?.thumburl || !info.thumbwidth || !info.thumbheight) continue;
      if (strict && info.width !== undefined && info.width < MIN_ORIGINAL_WIDTH) continue;
      const file = fileOf(page.title);
      const meta = info.extmetadata ?? {};
      out.set(file, {
        file,
        url: info.thumburl,
        width: info.thumbwidth,
        height: info.thumbheight,
        credit: plainText(meta.Artist?.value ?? '') || 'Unknown',
        license: plainText(meta.LicenseShortName?.value ?? ''),
        sourceUrl:
          info.descriptionurl ??
          `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
      });
    }
    return out;
  }

  private async query(endpoint: string, params: Record<string, string>): Promise<WikiResponse> {
    const url = new URL(endpoint);
    const all = { action: 'query', format: 'json', origin: '*', ...params };
    for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
    const res = await this.fetchFn(url.toString(), { headers: { 'Api-User-Agent': 'Cellar/1.0' } });
    if (!res.ok) throw new Error(`Wikimedia request failed (${res.status})`);
    return (await res.json()) as WikiResponse;
  }

  /**
   * 7-day device cache. A missing photo is cached too (an article without an image rarely gains
   * one); a failure never is. Callers asking at the same moment share one request.
   */
  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.read<T>(key);
    if (hit) return Promise.resolve(hit.value);
    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const request = load()
      .then((value) => {
        this.store.set(key, JSON.stringify({ value, fetchedAt: this.now() }));
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private read<T>(key: string): CacheEntry<T> | null {
    const raw = this.store.get(key);
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as CacheEntry<T>;
      const fresh = typeof entry.fetchedAt === 'number' && this.now() - entry.fetchedAt < CACHE_MS;
      return fresh && 'value' in entry ? entry : null;
    } catch {
      return null;
    }
  }
}
