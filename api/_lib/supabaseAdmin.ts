import { createClient } from '@supabase/supabase-js';

// Same public project URL/anon key as src/utils/supabaseClient.ts. Duplicated
// intentionally: this file runs in the Vercel serverless (Node) runtime, a
// separate bundle from the Vite frontend in src/, and importing across that
// boundary would drag in browser-only code (localStorage, etc.) that doesn't
// exist in Node.
export const SUPABASE_URL = 'https://ohhjcqihrjmewfbymhar.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oaGpjcWlocmptZXdmYnltaGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTU0MjcsImV4cCI6MjEwMDE5MTQyN30.DmvCcF9w7fArZojyY8Xczzs4Ji4RyPv08fQJBEH-REc';

/**
 * Admin client using the Supabase Service Role Key. Bypasses RLS entirely —
 * used ONLY to manage the mcp_oauth_* tables (never to touch user data like
 * transactions/categories, which always go through a per-user scoped client
 * so RLS enforces isolation).
 *
 * Requires the SUPABASE_SERVICE_ROLE_KEY environment variable to be set on
 * Vercel. This key must never be exposed to the browser bundle.
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY belum di-set. Tambahkan sebagai environment variable di Vercel (Settings > Environment Variables) lalu redeploy.'
    );
  }
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Plain anon-key client with no session persistence. Used to perform
 * password sign-in and refresh-token exchanges on behalf of a specific
 * KasUsaha user during the OAuth dance and per-MCP-request session resolution.
 */
export function getSupabaseAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * A client scoped to one user's live access token, so every query it makes
 * is subject to that user's Row Level Security policies (auth.uid() = user_id).
 */
export function getScopedSupabaseClient(userAccessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${userAccessToken}` } },
  });
}
