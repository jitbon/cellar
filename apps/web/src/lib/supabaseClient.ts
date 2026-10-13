import { createClient } from '@supabase/supabase-js';

// Anon (public) key only; the service-role key is never shipped to the client.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'missing-anon-key',
);
