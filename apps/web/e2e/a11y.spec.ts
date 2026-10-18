import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  createAccount,
  createTrip,
  dateIn,
  deleteAccount,
  goToDay,
  mockOpenMeteo,
  mockWikimedia,
  mockPlaces,
  mockProviders,
  openChipMenu,
  openDayMenu,
  setItemPanel,
  setTripLocationDirect,
  signIn,
  type Account,
} from './helpers';

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map(
      (v) =>
        `${v.id}: ${v.help} ${v.nodes
          .map((n) => `${n.target.join(' ')} ${JSON.stringify(n.any[0]?.data ?? {})}`)
          .join(' | ')}`,
    ),
  ).toEqual([]);
}

test('SC-006: create trip, add item, place item, edit block using only the keyboard', async ({
  page,
}) => {
  await signIn(page, account);

  // Create a trip without the mouse.
  await page.getByRole('button', { name: 'New trip' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Name', { exact: true }).fill('Keys');
  await page.keyboard.press('Tab');
  await page.getByLabel('Start date').fill('2027-04-01');
  await page.getByLabel('End date').fill('2027-04-03');
  await page.getByLabel('End date').press('Enter');
  await expect(page.getByRole('heading', { name: 'Keys' })).toBeVisible();

  // Add a list item.
  const showList = page.getByRole('button', { name: 'Show list' });
  if ((await showList.getAttribute('aria-expanded')) !== 'true') {
    await showList.focus();
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: 'Add', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Name', { exact: true }).first().focus();
  await page.keyboard.type('Tsukiji Market');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Tsukiji Market')).toBeVisible();

  // Place it with the non-drag alternative.
  await page.getByRole('button', { name: 'Actions for Tsukiji Market' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Place Tsukiji Market in a block' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Time block').selectOption({ label: 'Breakfast' });
  await page.getByRole('button', { name: 'Place', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Tsukiji Market, placed' }),
  ).toBeVisible();
  await setItemPanel(page, false);

  // Rename a block.
  await goToDay(page, 1);
  await page.getByRole('button', { name: 'Rename Evening' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Rename Evening').fill('Late evening');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Rename Late evening' })).toBeVisible();

  // No horizontal page scroll (the grid scrolls inside its own container).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('axe: sign-in, trips and planner have no serious or critical violations', async ({ page }) => {
  await page.goto('/signin');
  await expectNoSeriousViolations(page);

  await signIn(page, account);
  await expectNoSeriousViolations(page);

  await createTrip(page, 'Axe', '2027-04-01', '2027-04-02');
  await expectNoSeriousViolations(page);
});

test('axe: weather icons, an open popover and the location picker have no serious violations', async ({
  page,
}) => {
  await mockOpenMeteo(page, 'ok');
  await signIn(page, account);
  await createTrip(page, 'Axe weather', dateIn('Asia/Tokyo', 0), dateIn('Asia/Tokyo', 2));
  await setTripLocationDirect(page.url().split('/').pop()!, {
    name: 'Kyoto, Japan',
    lat: 35.0211,
    lon: 135.7538,
    tz: 'Asia/Tokyo',
  });
  await page.reload();
  await goToDay(page, 1);

  const icon = page.getByRole('button', { name: /^Afternoon weather:/ }).first();
  await expect(icon).toBeVisible();
  await expectNoSeriousViolations(page);

  await icon.focus();
  await expect(page.getByText('Weather data by Open-Meteo.com')).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Change trip location/ }).click();
  await page.getByRole('combobox', { name: 'Search for a place' }).fill('Kyo');
  await expect(page.getByRole('option', { name: 'Kyoto, Japan' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe (${scheme}): every screen, an open menu and an open popover`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });

    for (const path of ['/signin', '/signup', '/reset-password']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page);
    }

    await signIn(page, account);
    await expectNoSeriousViolations(page); // trips

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expectNoSeriousViolations(page);

    await page.goto('/');
    await createTrip(page, `Axe ${scheme}`, '2027-04-01', '2027-04-03');
    await setItemPanel(page, false);
    await goToDay(page, 1);
    await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-01' }).click();
    await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('Walk');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expectNoSeriousViolations(page); // planner, panel closed

    await openChipMenu(page, 'Walk');
    await expect(page.getByRole('menuitem', { name: 'Edit Walk' })).toBeVisible();
    await expectNoSeriousViolations(page); // chip menu
    await page.keyboard.press('Escape');

    await openDayMenu(page, '2027-04-01');
    await expect(page.getByRole('menuitem', { name: /^Set location for/ })).toBeVisible();
    await expectNoSeriousViolations(page); // day menu
    await page.keyboard.press('Escape');

    await setItemPanel(page, true);
    await expectNoSeriousViolations(page); // planner with the panel open
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add to list' })).toBeVisible();
    await expectNoSeriousViolations(page); // add-item popover
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe (${scheme}): place listbox, place line and Open in maps menu`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, `Axe places ${scheme}`, '2027-04-01', '2027-04-03');

    // Grid cell: list items group is absent here, so the listbox holds the Places group only.
    await setItemPanel(page, false);
    await goToDay(page, 1);
    await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-01' }).click();
    await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('chel');
    await expect(page.getByRole('option', { name: /Chelsea Market/ })).toBeVisible();
    await expect(page.getByText('Powered by Google')).toBeVisible();
    await expectNoSeriousViolations(page); // cell listbox with Places group
    await page.keyboard.press('ArrowDown');
    await expectNoSeriousViolations(page); // active option
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chip').filter({ hasText: 'Chelsea Market' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expectNoSeriousViolations(page); // pin on the chip

    await openChipMenu(page, 'Chelsea Market');
    await expect(page.getByText('Open in maps')).toBeVisible();
    await expectNoSeriousViolations(page); // chip menu with the maps group
    await page.keyboard.press('Escape');

    // Item panel form: listbox, then the place line under the name.
    await setItemPanel(page, true);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Chelsea Mar');
    await expect(
      page.getByRole('listbox', { name: 'Place suggestions' }).getByRole('option').first(),
    ).toBeVisible();
    await expectNoSeriousViolations(page); // form listbox
    await page.getByRole('option', { name: /Chelsea Market/ }).click();
    await expect(page.getByText('75 9th Ave, New York')).toBeVisible();
    await expectNoSeriousViolations(page); // place line and Remove place

    await page.getByLabel('Name', { exact: true }).fill('zzzxqq');
    await expect(page.getByText('No places found')).toBeVisible();
    await expectNoSeriousViolations(page); // empty note
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe (${scheme}): Popular tab, card menu, unavailable state and quick-add suggestions`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, `Axe popular ${scheme}`, '2027-04-01', '2027-04-03');
    await setTripLocationDirect(page.url().split('/').pop()!, {
      name: 'New York, USA',
      lat: 40.7128,
      lon: -74.006,
      tz: 'America/New_York',
    });
    await page.reload();
    await setItemPanel(page, true);
    const list = page.getByRole('complementary', { name: 'Activities and food' });
    const line = list.getByRole('combobox', { name: 'Add or filter items' });

    await list.getByRole('tab', { name: 'Popular' }).click();
    await expect(list.getByText('The Metropolitan Museum of Art')).toBeVisible();
    await expectNoSeriousViolations(page); // Popular tab with results

    await list.getByRole('button', { name: 'Actions for The Metropolitan Museum of Art' }).click();
    await expect(page.getByRole('menuitem', { name: 'Place in a block' })).toBeVisible();
    await expectNoSeriousViolations(page); // open card menu
    await page.getByRole('menuitem', { name: 'Place in a block' }).click();
    await page.getByRole('button', { name: 'Place', exact: true }).click();
    await expect(list.getByText('The Metropolitan Museum of Art, placed')).toBeAttached();
    await expectNoSeriousViolations(page); // struck-through card

    await list.getByRole('tab', { name: 'My list' }).click();
    await line.fill('Chelsea Mar');
    await expect(page.getByRole('option', { name: /Chelsea Market/ })).toBeVisible();
    await expectNoSeriousViolations(page); // quick-add suggestions
    await page.keyboard.press('Escape');

    // A fresh page load forgets the session's lists, so the next request fails.
    await page.unroute('**/functions/v1/places');
    await mockPlaces(page, 'fail');
    await list.getByRole('tab', { name: 'Popular' }).click();
    await page.reload();
    await setItemPanel(page, true);
    await expect(list.getByText('Popular places unavailable right now')).toBeVisible();
    await expectNoSeriousViolations(page); // unavailable state
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe (${scheme}): trip cards with photos, cover picker, city banner and place detail`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    await mockPlaces(page, 'ok');
    await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await createTrip(
      page,
      `Axe photos ${scheme}`,
      dateIn('America/New_York', -1),
      dateIn('America/New_York', 3),
    );
    const id = page.url().split('/').pop()!;
    await setTripLocationDirect(id, {
      name: 'New York, USA',
      lat: 40.7128,
      lon: -74.006,
      tz: 'America/New_York',
    });

    // The city banner, with its Today header.
    await page.reload();
    await expect(page.getByTestId('city-banner').locator('img')).toBeVisible();
    await expectNoSeriousViolations(page);

    // The detail view of a Popular card (photo, credit over the overlay).
    await setItemPanel(page, true);
    const list = page.getByRole('complementary', { name: 'Activities and food' });
    await list.getByRole('tab', { name: 'Popular' }).click();
    await list.getByRole('button', { name: 'The Metropolitan Museum of Art', exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'The Metropolitan Museum of Art' });
    await expect(detail.getByRole('img', { name: 'The Metropolitan Museum of Art' })).toBeVisible();
    await expectNoSeriousViolations(page);
    await detail.getByRole('button', { name: 'Close' }).click();

    // "Your trips" with photos and the cover picker.
    await page.goto('/');
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: `Axe photos ${scheme}` })
        .getByRole('img', { name: 'New York, USA' }),
    ).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.getByRole('button', { name: `Actions for Axe photos ${scheme}` }).click();
    await page.getByRole('menuitem', { name: 'Change cover photo' }).click();
    const picker = page.getByRole('dialog', { name: 'Change cover photo' });
    await expect(picker.getByRole('button', { name: /^Photo \d by / })).toHaveCount(6);
    await expectNoSeriousViolations(page);
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe (${scheme}): sign-in and create-account with every provider, and the callback page`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await mockProviders(page, ['google', 'apple', 'facebook']);

    for (const path of ['/signin', '/signup']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeVisible();
      await expectNoSeriousViolations(page);
    }

    // Hold the callback page on "Signing you in…": a pending sign-in whose tokens are being checked.
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'cellar:providerSignIn',
        JSON.stringify({
          provider: 'google',
          from: '/signin',
          returnTo: '/',
          startedAt: Date.now(),
        }),
      );
    });
    await page.route('**/auth/v1/user', () => new Promise(() => {}));
    await page.goto(
      '/auth/callback#access_token=x&refresh_token=y&expires_in=3600&token_type=bearer',
    );
    await expect(page.getByRole('status')).toHaveText('Signing you in…');
    await expectNoSeriousViolations(page);
  });
}
