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
export async function createAccount(domain = 'example.com'): Promise<Account> {
  const email = `e2e-${randomUUID()}@${domain}`;
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
    // Daylight 06:00-17:59, so evening and night blocks get the night icons.
    body.hourly.is_day = body.hourly.time.map((t: string) => {
      const hour = Number(t.slice(11, 13));
      return hour >= 6 && hour < 18 ? 1 : 0;
    });
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
  action: 'suggest' | 'details' | 'popular' | 'photo' | 'info';
  [key: string]: unknown;
}

/**
 * Routes the `places` Edge Function to fixtures so e2e never reaches Google. Returns the
 * request bodies seen, in order, so tests can assert what was sent (FR-014).
 */
export async function mockPlaces(
  page: Page,
  mode: 'ok' | 'fail',
  /** `info` answers the details lookup differently from the rest (default: like `mode`). */
  opts: { info?: 'ok' | 'fail' | 'not-found' } = {},
): Promise<PlacesRequest[]> {
  placesMocked.add(page);
  const requests: PlacesRequest[] = [];
  await page.route('**/functions/v1/places', async (route) => {
    const request = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = request.postDataJSON() as PlacesRequest;
    requests.push(body);
    if (body.action === 'info' && (mode === 'ok' || opts.info)) {
      const info = opts.info ?? 'ok';
      if (info === 'fail') {
        return route.fulfill({ status: 503, headers: cors, json: { error: 'unavailable' } });
      }
      if (info === 'not-found') {
        return route.fulfill({ status: 404, headers: cors, json: { error: 'not-found' } });
      }
      // The same details for any place, under its own id so its photo name matches.
      const id = String(body.placeId);
      const { info: base } = JSON.parse(fixture('places-info.json'));
      return route.fulfill({
        headers: cors,
        json: {
          info: { ...base, placeId: id, photo: { ...base.photo, name: `places/${id}/photos/p1` } },
        },
      });
    }
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

const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

export type ProviderName = 'google' | 'apple' | 'facebook';

/**
 * Makes the account service report the listed providers as turned on (they are all off locally).
 * Only the settings answer is rewritten; everything else reaches the real service.
 */
export async function mockProviders(page: Page, providers: ProviderName[]): Promise<void> {
  await page.route('**/auth/v1/settings', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    const res = await route.fetch();
    const body = await res.json();
    for (const p of providers) body.external[p] = true;
    return route.fulfill({ headers: corsHeaders, json: body });
  });
}

export type ProviderResult =
  /** The provider confirms; the person is signed in as this (existing) account. */
  | { session: Account }
  /** The provider sends the person back with an error. */
  | { error: string; errorCode?: string; description?: string; inQuery?: boolean };

/**
 * Stands in for the provider's whole round trip: the account service's authorize address answers
 * with a redirect straight back to the app, carrying either a real session for a test account
 * (signed in through the Auth API) or an error. Returns the providers that were asked for.
 */
export async function mockProviderReturn(
  page: Page,
  provider: ProviderName,
  result: ProviderResult,
): Promise<ProviderName[]> {
  const asked: ProviderName[] = [];
  await page.route('**/auth/v1/authorize?**', async (route) => {
    const requested = new URL(route.request().url());
    if (requested.searchParams.get('provider') !== provider) return route.fallback();
    asked.push(provider);
    const redirectTo = requested.searchParams.get('redirect_to')!;
    let suffix: string;
    if ('session' in result) {
      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data, error } = await client.auth.signInWithPassword({
        email: result.session.email,
        password: result.session.password,
      });
      if (error || !data.session) throw error ?? new Error('sign-in failed');
      const { access_token, refresh_token } = data.session;
      suffix = `#access_token=${access_token}&refresh_token=${refresh_token}&expires_in=3600&token_type=bearer`;
    } else {
      const q = new URLSearchParams({ error: result.error });
      if (result.errorCode) q.set('error_code', result.errorCode);
      if (result.description) q.set('error_description', result.description);
      suffix = `${result.inQuery ? '?' : '#'}${q.toString()}`;
    }
    return route.fulfill({ status: 302, headers: { location: redirectTo + suffix } });
  });
  return asked;
}

/** Marks an account for deletion the way the app does, as that account (test setup only). */
export async function requestDeletionDirect(account: Account): Promise<void> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) throw error;
  const { error: rpcError } = await client.rpc('request_account_deletion');
  if (rpcError) throw rpcError;
  await client.auth.signOut();
}

/** Sets the sign-in methods the account service records for an account (test setup only). */
export async function setProvidersDirect(account: Account, providers: string[]): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(account.id, {
    app_metadata: { providers },
  });
  if (error) throw error;
}
