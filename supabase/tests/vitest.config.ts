import { defineConfig } from 'vitest/config';

// Run against a local Supabase (`supabase start`). Set SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY (see `supabase status -o env`), plus SUPABASE_DB_URL for backdating.
export default defineConfig({
  test: {
    include: ['supabase/tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
