import { expect, test } from '@playwright/test';
import {
  createAccount,
  createTrip,
  deleteAccount,
  goToDay,
  openBlockMenu,
  openChipMenu,
  openDayMenu,
  openTripSettings,
  setItemPanel,
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

test('quickstart scenarios 2-11: plan a trip end to end', async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, account);

  // 2: create a 5-day trip with 10 default blocks
  await createTrip(page, 'Tokyo', '2027-04-01', '2027-04-05');
  for (const block of [
    'Morning',
    'Breakfast',
    'Late morning',
    'Lunch',
    'Afternoon',
    'Late afternoon',
    'Dinner',
    'Dessert',
    'Evening',
    'Night',
  ]) {
    await expect(page.getByRole('button', { name: `Rename ${block}`, exact: true })).toBeVisible();
  }

  // 3: type two events into one cell
  await goToDay(page, 2);
  await page.getByRole('button', { name: 'Add event to Afternoon on 2027-04-02' }).click();
  await page.getByRole('combobox', { name: /Add event to Afternoon/ }).fill('Walk around Shibuya');
  await page.keyboard.press('Enter');
  await page.getByRole('combobox', { name: /Add event to Afternoon/ }).fill('Coffee');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Walk around Shibuya')).toBeVisible();
  await expect(page.getByText('Coffee', { exact: true })).toBeVisible();

  // 4: switch Coffee to Food place
  await openChipMenu(page, 'Coffee');
  await page.getByRole('menuitem', { name: 'Switch Coffee to Food place' }).click();
  await openChipMenu(page, 'Coffee');
  await expect(page.getByRole('menuitem', { name: 'Switch Coffee to Activity' })).toBeVisible();
  await page.keyboard.press('Escape');

  // 5: add a list item and use the suggestion
  // On narrow screens the list is a bottom sheet that covers the grid: open it only when needed.
  const openList = () => setItemPanel(page, true);
  const closeList = () => setItemPanel(page, false);
  await openList();
  const list = page.getByRole('complementary', { name: 'Activities and food' });
  await list.getByRole('button', { name: 'Add', exact: true }).click();
  await list.getByLabel('Name', { exact: true }).fill('Ichiran Ramen');
  await list.getByLabel('Type').selectOption('food');
  await list.getByRole('button', { name: 'Add to list' }).click();
  await expect(list.getByText('Ichiran Ramen')).toBeVisible();
  await closeList();
  await goToDay(page, 3);
  await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-03' }).click();
  await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('ichi');
  await page.getByRole('option', { name: /Ichiran Ramen/ }).click();
  await openList();
  await expect(list.getByText(/placed 1×/)).toBeVisible();

  // 7: deleting the list item keeps the placement
  await list.getByRole('button', { name: 'Actions for Ichiran Ramen' }).click();
  await page.getByRole('menuitem', { name: 'Delete Ichiran Ramen' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(page.getByText('Ichiran Ramen').first()).toBeVisible();

  // 10: undo / redo
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(list.getByText('Ichiran Ramen')).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(list.getByText('Ichiran Ramen')).toHaveCount(0);

  // 8: add a block
  await closeList();
  await openBlockMenu(page, 'Afternoon');
  await page.getByRole('menuitem', { name: 'Add block below Afternoon' }).click();
  await page.getByLabel('Block name').fill('Tea');
  await page.getByRole('button', { name: 'Add block', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rename Tea' })).toBeVisible();

  // survive a reload
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename Tea' })).toBeVisible();
});

test('quickstart 9 and 11: travel window greys cells; shrinking warns', async ({ page }) => {
  await signIn(page, account);
  await createTrip(page, 'Osaka', '2027-05-01', '2027-05-03');

  await openDayMenu(page, '2027-05-01');
  await page.getByRole('menuitem', { name: 'Set arrival and departure for 2027-05-01' }).click();
  await page.getByLabel('Arrival block').selectOption({ label: 'Lunch' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Arrive · Lunch')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Outside travel window' }).first()).toBeVisible();

  await goToDay(page, 3);
  await page.getByRole('button', { name: 'Add event to Morning on 2027-05-03' }).click();
  await page.getByRole('combobox', { name: /Add event to Morning/ }).fill('Castle');
  await page.keyboard.press('Enter');

  await openTripSettings(page);
  await page.getByLabel('End date').fill('2027-05-02');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/1 placement on removed days will be deleted/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).last().click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Castle')).toBeVisible();
});

test('quickstart 16: another account cannot open the trip', async ({ page, browser }) => {
  await signIn(page, account);
  await createTrip(page, 'Private', '2027-06-01', '2027-06-02');
  const tripUrl = page.url();

  const other = await createAccount();
  const context = await browser.newContext();
  const otherPage = await context.newPage();
  await signIn(otherPage, other);
  await otherPage.goto(tripUrl);
  await expect(otherPage.getByRole('heading', { name: 'Trip not found' })).toBeVisible();
  await context.close();
  await deleteAccount(other);
});
