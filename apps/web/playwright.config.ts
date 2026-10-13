import { defineConfig, devices } from '@playwright/test';

// Requires a running local Supabase (`supabase start`) and these env vars:
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (app) and SUPABASE_SERVICE_ROLE_KEY (test users).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, hasTouch: true },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
