import { expect, test } from '@playwright/test';
import { createAccount, createTrip, deleteAccount, signIn, type Account } from './helpers';

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

test('SC-007: an edit in one browser appears in another within 5 s', async ({ browser }) => {
  test.skip(test.info().project.name !== 'desktop', 'sync is viewport independent');
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await signIn(a, account);
  await createTrip(a, 'Sync', '2027-04-01', '2027-04-03');
  await signIn(b, account);
  await b.goto(a.url());
  await expect(b.getByRole('heading', { name: 'Sync' })).toBeVisible();

  await a.getByRole('button', { name: 'Add event to Lunch on 2027-04-02' }).click();
  await a.getByRole('combobox', { name: /Add event to Lunch/ }).fill('Synced event');
  await a.keyboard.press('Enter');

  await expect(b.getByText('Synced event')).toBeVisible({ timeout: 5000 });
});

test('FR-020: an offline edit shows "Not saved — retrying" and saves on reconnect', async ({
  browser,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'connectivity is viewport independent');
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, account);
  await createTrip(page, 'Offline', '2027-04-01', '2027-04-03');

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-01' }).click();
  await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('While offline');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Not saved — retrying')).toBeVisible({ timeout: 10_000 });

  await context.setOffline(false);
  await expect(page.getByText('Not saved — retrying')).toHaveCount(0, { timeout: 15_000 });

  await page.reload();
  await expect(page.getByText('While offline')).toBeVisible();
});
