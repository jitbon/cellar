import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { admin, createAccount, deleteAccount, signIn, type Account } from './helpers';

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

test('a typed placement appears within 100 ms on a 60-day x 10-block x 300-placement trip', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'measured on desktop');

  const tripId = randomUUID();
  const must = (r: { error: unknown }) => {
    if (r.error) throw r.error;
  };
  must(
    await admin.from('trips').insert({
      id: tripId,
      owner_id: account.id,
      name: 'Perf',
      start_date: '2027-01-01',
      end_date: '2027-03-01',
    }),
  );
  const blocks = Array.from({ length: 10 }, (_, i) => ({
    id: randomUUID(),
    trip_id: tripId,
    name: `Block ${i + 1}`,
    position: `a${i}`,
  }));
  must(await admin.from('blocks').insert(blocks));
  const start = Date.UTC(2027, 0, 1);
  const placements = Array.from({ length: 300 }, (_, i) => ({
    id: randomUUID(),
    trip_id: tripId,
    date: new Date(start + (i % 60) * 86_400_000).toISOString().slice(0, 10),
    block_id: blocks[i % 10].id,
    position: `a${i}`,
    name: `Event ${i}`,
  }));
  must(await admin.from('placements').insert(placements));

  await signIn(page, account);
  await page.goto(`/trips/${tripId}`);
  await expect(page.getByRole('heading', { name: 'Perf' })).toBeVisible();

  await page.getByRole('button', { name: 'Add event to Block 1 on 2027-01-02' }).click();
  const input = page.getByRole('combobox', { name: /Add event to Block 1 on 2027-01-02/ });
  await input.fill('Timed event');

  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const t0 = performance.now();
        const observer = new MutationObserver(() => {
          if (document.body.textContent?.includes('Timed event')) {
            // Only count once the card (not the input value) is rendered.
            const chips = [...document.querySelectorAll('[data-testid="chip"]')];
            if (chips.some((c) => c.textContent?.includes('Timed event'))) {
              observer.disconnect();
              resolve(performance.now() - t0);
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        const el = document.activeElement as HTMLInputElement;
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }),
  );
  expect(ms).toBeLessThan(100);
});
