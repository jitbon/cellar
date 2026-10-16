import { expect, test, type Page } from '@playwright/test';
import {
  createAccount,
  createTrip,
  dateIn,
  deleteAccount,
  mockOpenMeteo,
  mockWikimedia,
  setTripLocationDirect,
  signIn,
  type Account,
} from './helpers';

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
