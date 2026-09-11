import { getSupabaseAdmin } from './supabaseAdmin';
import { generateToken, hashToken } from './crypto';

const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ACCESS_TOKEN_TTL_SECONDS = 3600; // 1 hour

export interface OAuthClient {
  client_id: string;
  client_secret_hash: string | null;
  client_name: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
}

export async function registerClient(params: {
  clientName?: string;
  redirectUris: string[];
  tokenEndpointAuthMethod?: string;
}): Promise<{ client_id: string; client_secret?: string }> {
  const admin = getSupabaseAdmin();
  const client_id = generateToken(16);
  const wantsSecret =
    params.tokenEndpointAuthMethod === 'client_secret_post' ||
    params.tokenEndpointAuthMethod === 'client_secret_basic';
  const client_secret = wantsSecret ? generateToken(32) : undefined;

  const { error } = await admin.from('mcp_oauth_clients').insert({
    client_id,
    client_secret_hash: client_secret ? hashToken(client_secret) : null,
    client_name: params.clientName || null,
    redirect_uris: params.redirectUris,
    token_endpoint_auth_method: wantsSecret ? params.tokenEndpointAuthMethod! : 'none',
  });
  if (error) throw new Error(`Gagal mendaftarkan client: ${error.message}`);

  return { client_id, client_secret };
}

export async function getClient(client_id: string): Promise<OAuthClient | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('mcp_oauth_clients')
    .select('*')
    .eq('client_id', client_id)
    .maybeSingle();
  if (error || !data) return null;
  return data as OAuthClient;
}

export async function createAuthorizationCode(params: {
  client_id: string;
  redirect_uri: string;
  code_challenge?: string | null;
  code_challenge_method?: string | null;
  supabase_user_id: string;
  supabase_refresh_token: string;
}): Promise<string> {
  const admin = getSupabaseAdmin();
  const code = generateToken(32);
  const expires_at = new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString();

  const { error } = await admin.from('mcp_oauth_codes').insert({
    code_hash: hashToken(code),
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    code_challenge: params.code_challenge || null,
    code_challenge_method: params.code_challenge_method || null,
    supabase_user_id: params.supabase_user_id,
    supabase_refresh_token: params.supabase_refresh_token,
    expires_at,
  });
  if (error) throw new Error(`Gagal membuat kode otorisasi: ${error.message}`);
  return code;
}

export interface ConsumedCode {
  client_id: string;
  redirect_uri: string;
  code_challenge: string | null;
  code_challenge_method: string | null;
  supabase_user_id: string;
  supabase_refresh_token: string;
}

/** Looks up + immediately marks a code as used. Returns null if invalid, expired, or already used. */
export async function consumeAuthorizationCode(code: string): Promise<ConsumedCode | null> {
  const admin = getSupabaseAdmin();
  const code_hash = hashToken(code);
  const { data, error } = await admin
    .from('mcp_oauth_codes')
    .select('*')
    .eq('code_hash', code_hash)
    .maybeSingle();
  if (error || !data) return null;
  if (data.used || new Date(data.expires_at).getTime() < Date.now()) return null;

  await admin.from('mcp_oauth_codes').update({ used: true }).eq('code_hash', code_hash);

  return data as ConsumedCode;
}

export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function issueTokens(params: {
  client_id: string;
  supabase_user_id: string;
  supabase_refresh_token: string;
}): Promise<IssuedTokens> {
  const admin = getSupabaseAdmin();
  const access_token = generateToken(32);
  const refresh_token = generateToken(32);
  const access_token_expires_at = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();

  const { error } = await admin.from('mcp_oauth_tokens').insert({
    client_id: params.client_id,
    supabase_user_id: params.supabase_user_id,
    supabase_refresh_token: params.supabase_refresh_token,
    access_token_hash: hashToken(access_token),
    access_token_expires_at,
    refresh_token_hash: hashToken(refresh_token),
  });
  if (error) throw new Error(`Gagal menerbitkan token: ${error.message}`);

  return { access_token, refresh_token, expires_in: ACCESS_TOKEN_TTL_SECONDS };
}

/** OAuth `refresh_token` grant: mints a new MCP access token, keeping the same refresh token. */
export async function rotateAccessToken(
  refresh_token: string
): Promise<(IssuedTokens & { supabase_user_id: string; supabase_refresh_token: string; client_id: string }) | null> {
  const admin = getSupabaseAdmin();
  const refresh_token_hash = hashToken(refresh_token);
  const { data, error } = await admin
    .from('mcp_oauth_tokens')
    .select('*')
    .eq('refresh_token_hash', refresh_token_hash)
    .eq('revoked', false)
    .maybeSingle();
  if (error || !data) return null;

  const access_token = generateToken(32);
  const access_token_expires_at = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();

  const { error: updateError } = await admin
    .from('mcp_oauth_tokens')
    .update({
      access_token_hash: hashToken(access_token),
      access_token_expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq('refresh_token_hash', refresh_token_hash);
  if (updateError) throw new Error(`Gagal memperbarui token: ${updateError.message}`);

  return {
    access_token,
    refresh_token,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    supabase_user_id: data.supabase_user_id,
    supabase_refresh_token: data.supabase_refresh_token,
    client_id: data.client_id,
  };
}

export interface ResolvedToken {
  id: string;
  supabase_user_id: string;
  supabase_refresh_token: string;
  client_id: string;
}

export async function resolveAccessToken(access_token: string): Promise<ResolvedToken | null> {
  const admin = getSupabaseAdmin();
  const access_token_hash = hashToken(access_token);
  const { data, error } = await admin
    .from('mcp_oauth_tokens')
    .select('*')
    .eq('access_token_hash', access_token_hash)
    .eq('revoked', false)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.access_token_expires_at).getTime() < Date.now()) return null;

  return {
    id: data.id,
    supabase_user_id: data.supabase_user_id,
    supabase_refresh_token: data.supabase_refresh_token,
    client_id: data.client_id,
  };
}

/** Persists a rotated Supabase refresh token after the MCP endpoint refreshes the user's session. */
export async function updateStoredSupabaseRefreshToken(tokenRowId: string, newRefreshToken: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from('mcp_oauth_tokens')
    .update({ supabase_refresh_token: newRefreshToken, updated_at: new Date().toISOString() })
    .eq('id', tokenRowId);
}
