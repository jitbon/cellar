import { randomUUID } from 'node:crypto';
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
export async function createAccount(): Promise<Account> {
  const email = `e2e-${randomUUID()}@example.com`;
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
  while (!(await page.getByText(`Day ${day} of`).isVisible())) await next.click();
}
