import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';

const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface Account {
  id: string;
  email: string;
  password: string;
}

/** A confirmed user, created through the admin API so no email round trip is needed. */
export async function createAccount(): Promise<Account> {
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  return { id: data.user.id, email, password };
}

export async function deleteAccount(account: Account): Promise<void> {
  await admin.auth.admin.deleteUser(account.id);
}

export async function signIn(page: Page, account: Account): Promise<void> {
  // The item panel (Popular tab, quick-add suggestions) calls the `places` function, which on a
  // developer machine holds a real Google key. A spec that did not choose a mock gets a failing
  // one, so no test can reach Google.
  if (!placesMocked.has(page)) await mockPlaces(page, 'fail');
  // Same for city photos: trip cards and the banner would otherwise reach Wikimedia.
  if (!wikimediaMocked.has(page)) await mockWikimedia(page, 'fail');
  await page.goto('/signin');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible();
}

export async function createTrip(
  page: Page,
  name: string,
  start: string,
  end: string,
): Promise<void> {
  await page.getByRole('button', { name: 'New trip' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Start date').fill(start);
  await page.getByLabel('End date').fill(end);
  await page.getByRole('button', { name: 'Create trip' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

/** On narrow viewports the grid shows one day at a time; move to the given 1-based day. */
export async function goToDay(page: Page, day: number): Promise<void> {
  const next = page.getByRole('button', { name: 'Next day' });
  if (!(await next.isVisible())) return;
  // The day switcher is the live region; the city banner can also say "Day N of M".
  const current = page.locator('[aria-live="polite"]').filter({ hasText: `Day ${day} of` });
  while (!(await current.isVisible())) await next.click();
}

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** Calendar date (YYYY-MM-DD) `offset` days from today in the given time zone. */
export function dateIn(tz: string, offset: number): string {
  const ms = Date.now() + offset * 86_400_000;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(ms);
}

/**
 * Routes Open-Meteo to fixtures. The forecast fixture's dates are placeholders (day 0 to 15);
 * they are rewritten to start today in the fixture's time zone.
 */
export async function mockOpenMeteo(page: Page, mode: 'ok' | 'fail'): Promise<void> {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    if (mode === 'fail') return route.fulfill({ status: 503, body: 'unavailable' });
    const body = JSON.parse(fixture('open-meteo-forecast.json'));
    body.hourly.time = body.hourly.time.map(
      (t: string, i: number) => `${dateIn(body.timezone, Math.floor(i / 24))}T${t.slice(11)}`,
    );
    return route.fulfill({ json: body });
  });
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    const name = new URL(route.request().url()).searchParams.get('name');
    const file =
      name === 'zzzxqq' ? 'open-meteo-geocode-empty.json' : 'open-meteo-geocode-kyoto.json';
    return route.fulfill({ body: fixture(file), contentType: 'application/json' });
  });
}

const wikimediaMocked = new WeakSet<Page>();

export interface WikimediaRequest {
  /** 'search' and 'images' go to Wikipedia, 'imageinfo' to Commons. */
  kind: 'search' | 'images' | 'imageinfo';
  url: string;
}

const photoFixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

/**
 * Routes Wikipedia, Commons and the image host to fixtures so e2e never reaches Wikimedia.
 * Returns the requests seen, in order. `fail` answers every call with 503.
 */
export async function mockWikimedia(page: Page, mode: 'ok' | 'fail'): Promise<WikimediaRequest[]> {
  wikimediaMocked.add(page);
  const requests: WikimediaRequest[] = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await page.route(
    /^https:\/\/(en\.wikipedia|commons\.wikimedia)\.org\/w\/api\.php/,
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const q = new URL(request.url()).searchParams;
      const generator = q.get('generator');
      const kind =
        generator === 'search' ? 'search' : generator === 'images' ? 'images' : 'imageinfo';
      requests.push({ kind, url: request.url() });
      if (mode === 'fail')
        return route.fulfill({ status: 503, headers: cors, body: 'unavailable' });
      const file = {
        search: 'wikimedia-search-kyoto.json',
        images: 'wikimedia-images-kyoto.json',
        imageinfo: 'wikimedia-imageinfo.json',
      }[kind];
      const body = JSON.parse(fixture(file));
      if (kind === 'imageinfo') {
        // Answer only for the files asked about, like the real API.
        const wanted = new Set((q.get('titles') ?? '').split('|'));
        body.query.pages = Object.fromEntries(
          Object.entries(body.query.pages as Record<string, { title: string }>).filter(([, p]) =>
            wanted.has(p.title),
          ),
        );
      }
      return route.fulfill({ headers: cors, json: body });
    },
  );
  await page.route('https://upload.wikimedia.org/**', (route) =>
    mode === 'fail'
      ? route.fulfill({ status: 503, body: 'unavailable' })
      : route.fulfill({ path: photoFixture('photo-a.jpg') }),
  );
  return requests;
}

const placesMocked = new WeakSet<Page>();

export interface PlacesRequest {
  action: 'suggest' | 'details' | 'popular' | 'photo';
  [key: string]: unknown;
}

/**
 * Routes the `places` Edge Function to fixtures so e2e never reaches Google. Returns the
 * request bodies seen, in order, so tests can assert what was sent (FR-014).
 */
export async function mockPlaces(page: Page, mode: 'ok' | 'fail'): Promise<PlacesRequest[]> {
  placesMocked.add(page);
  const requests: PlacesRequest[] = [];
  await page.route('**/functions/v1/places', async (route) => {
    const request = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = request.postDataJSON() as PlacesRequest;
    requests.push(body);
    if (mode === 'fail') {
      return route.fulfill({ status: 503, headers: cors, json: { error: 'unavailable' } });
    }
    if (body.action === 'photo') {
      // A URL on the app's own origin, served from a fixture image below.
      const origin = new URL(page.url()).origin;
      const photoUri = `${origin}/__test-photo/${String(body.name)}.jpg`;
      return route.fulfill({ headers: cors, json: { photoUri } });
    }
    let file: string;
    if (body.action === 'suggest') {
      const input = String(body.input ?? '').toLowerCase();
      file = input.includes('taco')
        ? 'places-suggest-tacos.json'
        : input.includes('katz')
          ? 'places-suggest-katz.json'
          : input.includes('zzzxqq')
            ? 'places-suggest-empty.json'
            : 'places-suggest-chelsea.json';
    } else if (body.action === 'popular') {
      file = body.group === 'food' ? 'places-popular-food.json' : 'places-popular-todo.json';
    } else {
      file =
        body.placeId === 'test-tacos'
          ? 'places-details-tacos.json'
          : body.placeId === 'test-katz'
            ? 'places-details-katz.json'
            : 'places-details-chelsea.json';
    }
    return route.fulfill({ headers: cors, body: fixture(file), contentType: 'application/json' });
  });
  await page.route('**/__test-photo/**', (route) =>
    route.fulfill({ path: photoFixture('photo-b.jpg') }),
  );
  return requests;
}

/** Sets a trip's location straight in the database (test setup only). */
export async function setTripLocationDirect(
  tripId: string,
  loc: { name: string; lat: number; lon: number; tz: string },
): Promise<void> {
  const { error } = await admin
    .from('trips')
    .update({
      location_name: loc.name,
      location_lat: loc.lat,
      location_lon: loc.lon,
      location_tz: loc.tz,
    })
    .eq('id', tripId);
  if (error) throw error;
}

/** Sets one day's own location straight in the database (test setup only). */
export async function setDayLocationDirect(
  tripId: string,
  date: string,
  loc: { name: string; lat: number; lon: number; tz: string },
): Promise<void> {
  const { error } = await admin.from('day_settings').upsert({
    trip_id: tripId,
    date,
    location_name: loc.name,
    location_lat: loc.lat,
    location_lon: loc.lon,
    location_tz: loc.tz,
  });
  if (error) throw error;
}

/** Opens the "⋯" actions menu of a placement chip. */
export async function openChipMenu(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
}

/** Opens the "⋯" options menu of a block label. */
export async function openBlockMenu(page: Page, block: string): Promise<void> {
  await page.getByRole('button', { name: `Options for ${block}`, exact: true }).click();
}

/** Opens the "⋯" menu of a day header. */
export async function openDayMenu(page: Page, date: string): Promise<void> {
  await page.getByRole('button', { name: `Day options for ${date}`, exact: true }).click();
}

/** Opens the header "⋯" menu and chooses Trip settings. */
export async function openTripSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More trip actions' }).click();
  await page.getByRole('menuitem', { name: 'Trip settings' }).click();
}

/** Opens or closes the item panel (a bottom sheet on phones) with the header toggle. */
export async function setItemPanel(page: Page, open: boolean): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Show list' });
  if (((await toggle.getAttribute('aria-expanded')) === 'true') !== open) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', String(open));
}
