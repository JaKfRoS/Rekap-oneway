import { getSupabaseAnonClient, getScopedSupabaseClient } from './supabaseAdmin';
import { resolveAccessToken, updateStoredSupabaseRefreshToken } from './oauthStore';

/**
 * Turns an MCP access token (issued by our /api/oauth/token endpoint) into a
 * live, per-user Supabase client. Every query made with the returned client
 * is subject to that user's own Row Level Security policies — the same
 * isolation the web app relies on — because it carries a real Supabase user
 * access token, not the service role key.
 *
 * Supabase rotates refresh tokens on every use: the refresh token returned
 * here is different from the one we had stored, so the old one becomes
 * invalid. We persist the new one immediately, otherwise the *next* MCP
 * request would fail to refresh the session.
 */
export async function resolveUserSession(
  mcpAccessToken: string
): Promise<{ userId: string; supabaseAccessToken: string } | null> {
  const resolved = await resolveAccessToken(mcpAccessToken);
  if (!resolved) return null;

  const anon = getSupabaseAnonClient();
  const { data, error } = await anon.auth.refreshSession({ refresh_token: resolved.supabase_refresh_token });
  if (error || !data.session) return null;

  if (data.session.refresh_token && data.session.refresh_token !== resolved.supabase_refresh_token) {
    await updateStoredSupabaseRefreshToken(resolved.id, data.session.refresh_token);
  }

  return { userId: resolved.supabase_user_id, supabaseAccessToken: data.session.access_token };
}

/** Convenience wrapper for callers that just want a ready-to-use scoped client. */
export async function getUserSupabaseClientForAccessToken(
  mcpAccessToken: string
): Promise<{ supabase: ReturnType<typeof getScopedSupabaseClient>; userId: string } | null> {
  const session = await resolveUserSession(mcpAccessToken);
  if (!session) return null;
  return { supabase: getScopedSupabaseClient(session.supabaseAccessToken), userId: session.userId };
}
