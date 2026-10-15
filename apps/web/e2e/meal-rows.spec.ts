import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  createAccount,
  createTrip,
  deleteAccount,
  mockOpenMeteo,
  mockPlaces,
  openBlockMenu,
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

const mealRow = (page: import('@playwright/test').Page, name: string) =>
  page
    .locator('[data-meal-row="true"]')
    .filter({ has: page.getByRole('button', { name: `Rename ${name}` }) });

test('meal rows follow their names and can be switched, surviving a reload', async ({ page }) => {
  await mockOpenMeteo(page, 'ok');
  await mockPlaces(page, 'fail');
  await signIn(page, account);
  await createTrip(page, 'Meal rows', '2027-04-01', '2027-04-03');

  // Defaults: meal names get the marker, activity names don't.
  await expect(mealRow(page, 'Lunch')).toHaveCount(1);
  await expect(mealRow(page, 'Lunch').getByRole('img', { name: 'Meal row' })).toBeVisible();
  await expect(mealRow(page, 'Afternoon')).toHaveCount(0);

  // Switch both ways from the row menu.
  await openBlockMenu(page, 'Lunch');
  await page.getByRole('menuitem', { name: 'Lunch is not a meal row' }).click();
  await openBlockMenu(page, 'Afternoon');
  await page.getByRole('menuitem', { name: 'Make Afternoon a meal row' }).click();
  await expect(mealRow(page, 'Lunch')).toHaveCount(0);
  await expect(mealRow(page, 'Afternoon')).toHaveCount(1);

  // Saved: still the same after a reload.
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(mealRow(page, 'Afternoon')).toHaveCount(1);
  await expect(mealRow(page, 'Lunch')).toHaveCount(0);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact ?? ''),
  );
  expect(serious).toEqual([]);
});
