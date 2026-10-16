import { expect, test, type Page } from '@playwright/test';
import {
  createAccount,
  createTrip,
  dateIn,
  deleteAccount,
  goToDay,
  mockOpenMeteo,
  mockPlaces,
  setItemPanel,
  mockWikimedia,
  setTripLocationDirect,
  signIn,
  type Account,
} from './helpers';

const NEW_YORK = { name: 'New York, USA', lat: 40.7128, lon: -74.006, tz: 'America/New_York' };
const KYOTO = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

const tripIdOf = (url: string) => url.split('/').pop()!;
const cardOf = (page: Page, name: string) =>
  page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: new RegExp(name) }) })
    .first();

/** Creates a trip (12 days from now in Kyoto, 5 days long), optionally located, and returns to the list. */
async function newTrip(page: Page, name: string, located = true): Promise<string> {
  await createTrip(page, name, dateIn(KYOTO.tz, 12), dateIn(KYOTO.tz, 16));
  const id = tripIdOf(page.url());
  if (located) await setTripLocationDirect(id, KYOTO);
  await page.goto('/');
  return id;
}

test.describe('US1: trip cards show a city photo', () => {
  test('quickstart 1: located cards show the photo, credit and status; others the placeholder', async ({
    page,
  }) => {
    const requests = await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Photo A', dateIn(KYOTO.tz, 12), dateIn(KYOTO.tz, 16));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.goto('/');
    await createTrip(page, 'Photo B no location', dateIn(KYOTO.tz, 12), dateIn(KYOTO.tz, 16));
    await page.goto('/');

    const located = cardOf(page, 'Photo A');
    const img = located.getByRole('img', { name: 'Kyoto, Japan' });
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', /upload\.wikimedia\.org.*Kyoto_A\.jpg/);
    await expect(located.getByText('In 12 days')).toBeVisible();
    const credit = located.getByRole('link', { name: 'Photo: Jane Doe · CC BY-SA 4.0' });
    await expect(credit).toHaveAttribute(
      'href',
      'https://commons.wikimedia.org/wiki/File:Kyoto_A.jpg',
    );
    await expect(credit).toHaveAttribute('target', '_blank');
    // The photo area has its fixed height, so the card does not jump when the photo arrives.
    expect((await img.boundingBox())!.height).toBeCloseTo(150, 0);

    const plain = cardOf(page, 'Photo B no location');
    await expect(plain.getByText('Set a location to get a cover photo')).toBeVisible();
    await expect(plain.getByRole('img')).toHaveCount(0);
    await expect(plain.getByText('In 12 days')).toBeVisible();

    // Only a city name is sent to Wikimedia (FR-009).
    const search = requests.find((r) => r.kind === 'search')!;
    expect(new URL(search.url).searchParams.get('gsrsearch')).toBe('Kyoto, Japan');

    await located.getByRole('link', { name: /Photo A/ }).click();
    await expect(page.getByRole('heading', { name: 'Photo A' })).toBeVisible();
  });

  test('quickstart 2 and 3: change the cover photo, undo it, and go back to automatic', async ({
    page,
  }) => {
    await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await newTrip(page, 'Photo C');
    const card = cardOf(page, 'Photo C');
    const img = card.getByRole('img', { name: 'Kyoto, Japan' });
    await expect(img).toHaveAttribute('src', /Kyoto_A\.jpg/);

    await card.getByRole('button', { name: 'Actions for Photo C' }).click();
    await page.getByRole('menuitem', { name: 'Change cover photo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change cover photo' });
    await expect(dialog.getByRole('button', { name: /^Photo \d by / })).toHaveCount(6);
    await expect(dialog.getByRole('button', { name: 'Photo 1 by Jane Doe' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(dialog.getByText('Selected')).toBeVisible();
    await dialog.getByRole('button', { name: 'Photo 2 by Jane Doe' }).click();
    await expect(dialog).toBeHidden();
    await expect(img).toHaveAttribute('src', /Kyoto_B\.jpg/);

    // Saved with the trip: it survives a reload.
    await page.reload();
    await expect(
      cardOf(page, 'Photo C').getByRole('img', { name: 'Kyoto, Japan' }),
    ).toHaveAttribute('src', /Kyoto_B\.jpg/);

    // Undo restores the automatic photo.
    await cardOf(page, 'Photo C').getByRole('button', { name: 'Actions for Photo C' }).click();
    await page.getByRole('menuitem', { name: 'Change cover photo' }).click();
    await page
      .getByRole('dialog', { name: 'Change cover photo' })
      .getByRole('button', { name: 'Photo 3 by Jane Doe' })
      .click();
    await expect(
      cardOf(page, 'Photo C').getByRole('img', { name: 'Kyoto, Japan' }),
    ).toHaveAttribute('src', /Kyoto_C\.jpg/);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(
      cardOf(page, 'Photo C').getByRole('img', { name: 'Kyoto, Japan' }),
    ).toHaveAttribute('src', /Kyoto_B\.jpg/);

    // "Use automatic photo" clears the choice.
    await cardOf(page, 'Photo C').getByRole('button', { name: 'Actions for Photo C' }).click();
    await page.getByRole('menuitem', { name: 'Change cover photo' }).click();
    await page
      .getByRole('dialog', { name: 'Change cover photo' })
      .getByRole('button', { name: 'Use automatic photo' })
      .click();
    await expect(
      cardOf(page, 'Photo C').getByRole('img', { name: 'Kyoto, Japan' }),
    ).toHaveAttribute('src', /Kyoto_A\.jpg/);
  });

  test('a trip without a location has no "Change cover photo" action', async ({ page }) => {
    await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await newTrip(page, 'Photo D', false);
    await cardOf(page, 'Photo D').getByRole('button', { name: 'Actions for Photo D' }).click();
    await expect(page.getByRole('menuitem', { name: 'Rename Photo D' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Change cover photo' })).toHaveCount(0);
  });

  test('quickstart 4: changing the trip location drops the chosen cover', async ({ page }) => {
    test.setTimeout(60_000);
    await mockOpenMeteo(page, 'ok');
    const requests = await mockWikimedia(page, 'ok');
    await signIn(page, account);
    const id = await newTrip(page, 'Photo E');
    await cardOf(page, 'Photo E').getByRole('button', { name: 'Actions for Photo E' }).click();
    await page.getByRole('menuitem', { name: 'Change cover photo' }).click();
    await page
      .getByRole('dialog', { name: 'Change cover photo' })
      .getByRole('button', { name: 'Photo 2 by Jane Doe' })
      .click();
    await expect(
      cardOf(page, 'Photo E').getByRole('img', { name: 'Kyoto, Japan' }),
    ).toHaveAttribute('src', /Kyoto_B\.jpg/);

    await page.goto(`/trips/${id}`);
    await page.getByRole('button', { name: /^Change trip location/ }).click();
    await page.getByRole('combobox', { name: 'Search for a place' }).fill('Osa');
    await page.getByRole('option', { name: 'Osaka, Japan' }).click();
    await expect(
      page.getByRole('button', { name: 'Change trip location (Osaka, Japan)' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Trips' }).click();
    const img = cardOf(page, 'Photo E').getByRole('img', { name: 'Osaka, Japan' });
    await expect(img).toHaveAttribute('src', /Kyoto_A\.jpg/);
    const searches = requests.filter((r) => r.kind === 'search');
    expect(
      searches.some((r) => new URL(r.url).searchParams.get('gsrsearch') === 'Osaka, Japan'),
    ).toBe(true);
  });

  test('quickstart 10: with Wikimedia down the cards show placeholders and still open', async ({
    page,
  }) => {
    await mockWikimedia(page, 'fail');
    await signIn(page, account);
    await newTrip(page, 'Photo F');
    const card = cardOf(page, 'Photo F');
    await expect(card.getByText('In 12 days')).toBeVisible();
    await expect(card.getByRole('img')).toHaveCount(0);
    await expect(card.getByText('Set a location to get a cover photo')).toHaveCount(0);
    await card.getByRole('link', { name: /Photo F/ }).click();
    await expect(page.getByRole('heading', { name: 'Photo F' })).toBeVisible();
  });
});

test.describe('US2: the trip page has a city banner and a Today header', () => {
  const banner = (page: Page) => page.getByTestId('city-banner');

  /** A New York trip that started yesterday (so today is day 2 of 5). */
  async function openNewYork(page: Page, name: string, located = true) {
    await createTrip(page, name, dateIn(NEW_YORK.tz, -1), dateIn(NEW_YORK.tz, 3));
    if (located) {
      await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
      await page.reload();
    }
  }

  test('quickstart 5: the banner shows the photo, city, progress and credit, and today says Today', async ({
    page,
  }) => {
    await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await openNewYork(page, 'Banner A');
    await expect(banner(page).getByText('New York, USA')).toBeVisible();
    await expect(banner(page).getByText('Day 2 of 5')).toBeVisible();
    await expect(banner(page).locator('img')).toHaveAttribute('src', /upload\.wikimedia\.org/);
    await expect(
      banner(page).getByRole('link', { name: 'Photo: Jane Doe · CC BY-SA 4.0' }),
    ).toBeVisible();

    await goToDay(page, 2);
    await expect(page.getByText('Today', { exact: true })).toHaveCount(1);
    // On phones only one day shows at a time: the day before today has no label.
    const previous = page.getByRole('button', { name: 'Previous day' });
    if (await previous.isVisible()) {
      await previous.click();
      await expect(page.getByText('Today', { exact: true })).toHaveCount(0);
    }
  });

  test('quickstart 6: Hide city banner persists across a reload, and Show brings it back', async ({
    page,
  }) => {
    await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await openNewYork(page, 'Banner B');
    await expect(banner(page)).toBeVisible();
    const height = (await banner(page).boundingBox())!.height;
    expect(height).toBeCloseTo(page.viewportSize()!.width < 640 ? 56 : 84, 0);

    await page.getByRole('button', { name: 'More trip actions' }).click();
    await page.getByRole('menuitem', { name: 'Hide city banner' }).click();
    await expect(banner(page)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Banner B' })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'More trip actions' }).click();
    await page.getByRole('menuitem', { name: 'Show city banner' }).click();
    await expect(banner(page)).toBeVisible();
  });

  test('no banner without a location, and none when the photo service is down', async ({
    page,
  }) => {
    await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await openNewYork(page, 'Banner C', false);
    await expect(banner(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'More trip actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Trip settings' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /city banner/ })).toHaveCount(0);
  });

  test('no banner when Wikimedia is down, and the planner still works', async ({ page }) => {
    await mockWikimedia(page, 'fail');
    await signIn(page, account);
    await openNewYork(page, 'Banner D');
    await expect(page.getByRole('heading', { name: 'Banner D' })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });

  test('a trip that is not happening today has no Today label', async ({ page }) => {
    await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Banner E', dateIn(NEW_YORK.tz, 20), dateIn(NEW_YORK.tz, 22));
    await expect(page.getByText('Today', { exact: true })).toHaveCount(0);
  });
});

test.describe('US3: Popular cards show small photos, loaded when in view', () => {
  const list = (page: Page) => page.getByRole('complementary', { name: 'Activities and food' });

  async function openPopular(page: Page, name: string) {
    await createTrip(page, name, '2027-04-01', '2027-04-05');
    await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
    await page.reload();
    await setItemPanel(page, true);
    await list(page).getByRole('tab', { name: 'Popular' }).click();
  }

  test('quickstart 7: only cards in view ask for a photo; scrolling asks for more; credits show', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 360 });
    const places = await mockPlaces(page, 'ok');
    await signIn(page, account);
    await openPopular(page, 'Thumbs A');

    const first = list(page).getByRole('listitem').filter({ hasText: 'The Metropolitan Museum' });
    await expect(first.locator('img')).toBeVisible();
    await expect(first.getByTestId('popular-thumb')).toHaveAttribute('title', 'Photo: Ann Lee');
    const photoRequests = () => places.filter((r) => r.action === 'photo');
    const initial = photoRequests().length;
    expect(initial).toBeGreaterThan(0);
    expect(initial).toBeLessThan(12); // 12 cards, a 360 px tall screen shows only a few
    for (const r of photoRequests()) {
      expect(Object.keys(r).sort()).toEqual(['action', 'maxWidthPx', 'name']);
      expect(r.maxWidthPx).toBe(160);
    }

    const cards = list(page).getByRole('listitem');
    for (let i = 0; i < (await cards.count()); i++) await cards.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => photoRequests().length).toBe(12);
    await expect(list(page).getByText(/^Photos:/)).toContainText('Ann Lee');
    await expect(list(page).getByRole('link', { name: 'Ann Lee' })).toHaveAttribute(
      'href',
      'https://maps.google.com/contrib/1',
    );
  });

  test('quickstart 10: when photos cannot load, cards keep the type icon and work', async ({
    page,
  }) => {
    const places = await mockPlaces(page, 'ok');
    await page.route('**/__test-photo/**', (route) => route.fulfill({ status: 404 }));
    await signIn(page, account);
    await openPopular(page, 'Thumbs B');
    const met = list(page).getByRole('listitem').filter({ hasText: 'The Metropolitan Museum' });
    await expect(met).toBeVisible();
    await expect.poll(() => places.filter((r) => r.action === 'photo').length).toBeGreaterThan(0);
    await met.getByRole('button', { name: /^Actions for / }).click();
    await expect(page.getByRole('menuitem', { name: 'Place in a block' })).toBeVisible();
  });
});

test.describe('US4: Popular card detail view', () => {
  const list = (page: Page) => page.getByRole('complementary', { name: 'Activities and food' });
  const MET = 'The Metropolitan Museum of Art';
  const detail = (page: Page) => page.getByRole('dialog', { name: MET });

  async function openPopular(page: Page, name: string) {
    await createTrip(page, name, '2027-04-01', '2027-04-05');
    await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
    await page.reload();
    await setItemPanel(page, true);
    await list(page).getByRole('tab', { name: 'Popular' }).click();
  }

  test('quickstart 8: click or Enter opens the detail; X, Esc and the backdrop close it', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await openPopular(page, 'Detail A');

    const card = list(page).getByRole('listitem').filter({ hasText: MET });
    await card.getByText('Art museum · 1000 5th Ave, New York').click();
    await expect(detail(page)).toBeVisible();
    await expect(detail(page).getByRole('img', { name: MET })).toBeVisible();
    await expect(detail(page).getByRole('link', { name: 'Photo: Ann Lee' })).toBeVisible();
    await expect(detail(page)).toContainText('4.8 (104,512 reviews)');
    await expect(detail(page).getByRole('button', { name: 'Place in a block' })).toBeVisible();
    await expect(detail(page).getByRole('button', { name: 'Add to my list' })).toBeVisible();
    await expect(detail(page).getByRole('button', { name: 'Open in maps' })).toBeVisible();
    await expect(detail(page).getByText(/^Planned:/)).toHaveCount(0);

    await detail(page).getByRole('button', { name: 'Close' }).click();
    await expect(detail(page)).toBeHidden();

    await card.getByRole('button', { name: MET, exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(detail(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(detail(page)).toBeHidden();

    await card.getByText('Art museum · 1000 5th Ave, New York').click();
    await expect(detail(page)).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(detail(page)).toBeHidden();
  });

  test('place from the detail, see it planned, add to the list and open maps', async ({ page }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await openPopular(page, 'Detail B');
    const card = list(page).getByRole('listitem').filter({ hasText: MET });
    await card.getByRole('button', { name: MET, exact: true }).click();
    await detail(page).getByRole('button', { name: 'Place in a block' }).click();
    const picker = page.getByRole('dialog', { name: `Place “${MET}”` });
    await picker.getByLabel('Day').selectOption('2027-04-03');
    await picker.getByLabel('Time block').selectOption({ label: 'Afternoon' });
    await picker.getByRole('button', { name: 'Place', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await card.getByRole('button', { name: new RegExp(`^${MET} ?, placed$`) }).click();
    await expect(detail(page).getByText('Planned: Sat Apr 3 · Afternoon')).toBeVisible();

    await detail(page).getByRole('button', { name: 'Add to my list' }).click();
    await detail(page).getByRole('button', { name: 'Open in maps' }).click();
    await expect(page.getByRole('menuitem', { name: 'Google Maps' })).toBeVisible();
    await page.keyboard.press('Escape');
    await detail(page).getByRole('button', { name: 'Close' }).click();
    await expect(detail(page)).toBeHidden();
    await list(page).getByRole('tab', { name: 'My list' }).click();
    await expect(list(page).getByTestId('item-name').filter({ hasText: MET })).toBeVisible();
  });

  test('quickstart 10: with no photo the detail shows a placeholder and still works', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await page.route('**/__test-photo/**', (route) => route.fulfill({ status: 404 }));
    await signIn(page, account);
    await openPopular(page, 'Detail C');
    const card = list(page).getByRole('listitem').filter({ hasText: MET });
    await card.getByRole('button', { name: MET, exact: true }).click();
    await expect(detail(page).getByRole('button', { name: 'Place in a block' })).toBeVisible();
  });

  test.describe('dragging (desktop)', () => {
    test.skip(({ hasTouch }) => hasTouch, 'mouse drag is exercised on desktop');
    test.use({ viewport: { width: 1440, height: 900 } });

    test('quickstart 9: dragging a card places it and does not open the detail', async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await mockPlaces(page, 'ok');
      await signIn(page, account);
      await openPopular(page, 'Detail D');
      const card = list(page).getByRole('listitem').filter({ hasText: MET });
      const target = page.getByTestId('cell:2027-04-01:Afternoon');
      const center = async (l: typeof card) => {
        const box = (await l.boundingBox())!;
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };
      const from = await center(card);
      const to = await center(target);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(
          from.x + ((to.x - from.x) * i) / 12,
          from.y + ((to.y - from.y) * i) / 12,
        );
      }
      await page.mouse.up();
      await expect(target.getByTestId('chip')).toContainText(MET);
      await expect(detail(page)).toHaveCount(0);
    });
  });
});
