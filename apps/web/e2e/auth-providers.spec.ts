import { expect, test, type Page } from '@playwright/test';
import {
  createAccount,
  createTrip,
  deleteAccount,
  mockPlaces,
  mockProviderReturn,
  mockProviders,
  mockWikimedia,
  requestDeletionDirect,
  setProvidersDirect,
  signIn,
  type Account,
} from './helpers';

// The provider round trip is mocked (research R10): the account service's settings report the
// providers on, and its authorize address answers with a redirect straight back to the app.

let account: Account;
const extra: Account[] = [];

test.beforeEach(async ({ page }) => {
  account = await createAccount();
  // Nothing in these flows may reach Google Places or Wikimedia.
  await mockPlaces(page, 'fail');
  await mockWikimedia(page, 'fail');
});
test.afterEach(async () => {
  await deleteAccount(account);
  for (const a of extra.splice(0)) await deleteAccount(a);
});

const continueWith = (page: Page, name: string) =>
  page.getByRole('button', { name: `Continue with ${name}` });

test.describe('US1: Google', () => {
  test('buttons appear only for providers that are on', async ({ page }) => {
    // Locally no provider is configured, so the pages look as they always did.
    await page.goto('/signin');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Continue with/ })).toHaveCount(0);

    await mockProviders(page, ['google']);
    await page.goto('/signin');
    await expect(continueWith(page, 'Google')).toBeVisible();
    await expect(continueWith(page, 'Apple')).toHaveCount(0);
    await expect(continueWith(page, 'Facebook')).toHaveCount(0);
    await page.goto('/signup');
    await expect(continueWith(page, 'Google')).toBeVisible();
  });

  test('continue with Google signs in and shows the trip list', async ({ page }) => {
    await mockProviders(page, ['google']);
    const asked = await mockProviderReturn(page, 'google', { session: account });
    await page.goto('/signin');
    await continueWith(page, 'Google').click();
    await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible();
    expect(asked).toEqual(['google']);
  });

  test('FR-003: a signed-out trip link opens that trip after signing in', async ({ page }) => {
    await signIn(page, account);
    await createTrip(page, 'Lisbon', '2027-03-01', '2027-03-03');
    const tripPath = new URL(page.url()).pathname;
    await page.evaluate(() => localStorage.clear());

    await mockProviders(page, ['google']);
    await mockProviderReturn(page, 'google', { session: account });
    await page.goto(tripPath);
    await expect(page).toHaveURL(/\/signin\?returnTo=/);
    await continueWith(page, 'Google').click();
    await expect(page.getByRole('heading', { name: 'Lisbon' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(tripPath);
  });

  test('cancelling returns to sign-in with a message', async ({ page }) => {
    await mockProviders(page, ['google']);
    await mockProviderReturn(page, 'google', { error: 'access_denied' });
    await page.goto('/signin');
    await continueWith(page, 'Google').click();
    await expect(page.getByText('Sign-in with Google was cancelled.')).toBeVisible();
    await expect(page).toHaveURL(/\/signin$/);
  });

  test('FR-004: signing in cancels a pending account deletion', async ({ page }) => {
    await requestDeletionDirect(account);
    await mockProviders(page, ['google']);
    await mockProviderReturn(page, 'google', { session: account });
    await page.goto('/signin');
    await continueWith(page, 'Google').click();
    await expect(page.getByText('Your account deletion was cancelled')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible();
  });

  test('SC-005: a failure shows a message and email sign-in still works', async ({ page }) => {
    await mockProviders(page, ['google']);
    await mockProviderReturn(page, 'google', { error: 'server_error' });
    await page.goto('/signin');
    await continueWith(page, 'Google').click();
    await expect(
      page.getByText("Couldn't sign in with Google. Try again or use another option."),
    ).toBeVisible();
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible();
  });

  test('create-account page: a failure returns to create-account', async ({ page }) => {
    await mockProviders(page, ['google']);
    await mockProviderReturn(page, 'google', { error: 'access_denied' });
    await page.goto('/signup');
    await continueWith(page, 'Google').click();
    await expect(page.getByText('Sign-in with Google was cancelled.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });
});

test.describe('US2: Apple', () => {
  test('Hide My Email account signs in and Settings shows the relay address', async ({ page }) => {
    const relay = await createAccount('privaterelay.appleid.com');
    extra.push(relay);
    await setProvidersDirect(relay, ['apple']);
    await mockProviders(page, ['apple']);
    await mockProviderReturn(page, 'apple', { session: relay });
    await page.goto('/signin');
    await continueWith(page, 'Apple').click();
    await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible();
    await page.goto('/settings');
    await expect(page.getByText(relay.email)).toBeVisible();
    await expect(page.getByText('Sign-in methods:').locator('..')).toHaveText(
      'Sign-in methods: Apple',
    );
  });

  test('cancelling names Apple', async ({ page }) => {
    await mockProviders(page, ['apple']);
    await mockProviderReturn(page, 'apple', { error: 'access_denied' });
    await page.goto('/signin');
    await continueWith(page, 'Apple').click();
    await expect(page.getByText('Sign-in with Apple was cancelled.')).toBeVisible();
  });
});

test.describe('US4: one account', () => {
  test('FR-006: an unconfirmed provider email is told to use email and password', async ({
    page,
  }) => {
    await mockProviders(page, ['google']);
    await mockProviderReturn(page, 'google', {
      error: 'server_error',
      errorCode: 'provider_email_needs_verification',
      description: 'Unverified email with google. A confirmation email has been sent',
      inQuery: true,
    });
    await page.goto('/signin');
    await continueWith(page, 'Google').click();
    await expect(
      page.getByText(
        "Google didn't confirm your email. Sign in with your email and password instead.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });
});

test.describe('US3: Facebook', () => {
  test('continue with Facebook signs in', async ({ page }) => {
    await mockProviders(page, ['facebook']);
    await mockProviderReturn(page, 'facebook', { session: account });
    await page.goto('/signin');
    await continueWith(page, 'Facebook').click();
    await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible();
  });

  test('FR-008: no email from Facebook gives a message and no session', async ({ page }) => {
    await mockProviders(page, ['facebook']);
    await mockProviderReturn(page, 'facebook', {
      error: 'server_error',
      description: 'Error getting user email from external provider',
      inQuery: true,
    });
    await page.goto('/signin');
    await continueWith(page, 'Facebook').click();
    await expect(
      page.getByText(
        "Facebook didn't share an email address. Allow email access or use another option.",
      ),
    ).toBeVisible();
    const stored = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.includes('auth-token')),
    );
    expect(stored).toEqual([]);
  });
});

test.describe('US5: sign-in methods', () => {
  test('Settings lists Email and password, Google', async ({ page }) => {
    await setProvidersDirect(account, ['email', 'google']);
    await mockProviders(page, ['google']);
    await mockProviderReturn(page, 'google', { session: account });
    await page.goto('/signin');
    await continueWith(page, 'Google').click();
    await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible();
    await page.goto('/settings');
    await expect(page.getByText('Sign-in methods:').locator('..')).toHaveText(
      'Sign-in methods: Email and password, Google',
    );
    await expect(page.getByText(account.email)).toBeVisible();
  });
});
