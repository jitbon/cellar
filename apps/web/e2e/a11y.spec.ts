import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createAccount, createTrip, deleteAccount, goToDay, signIn, type Account } from './helpers';

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
  expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
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
  if (await showList.isVisible()) {
    await showList.focus();
    await page.keyboard.press('Enter');
  }
  await page.getByLabel('Name', { exact: true }).first().focus();
  await page.keyboard.type('Tsukiji Market');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Tsukiji Market')).toBeVisible();

  // Place it with the non-drag alternative.
  await page.getByRole('button', { name: 'Place Tsukiji Market in a block' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Time block').selectOption({ label: 'Breakfast' });
  await page.getByRole('button', { name: 'Place', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/placed 1×/)).toBeVisible();

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
