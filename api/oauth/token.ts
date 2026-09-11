import { consumeAuthorizationCode, issueTokens, rotateAccessToken, getClient } from '../_lib/oauthStore';
import { verifyPkce, hashToken } from '../_lib/crypto';

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const params = await readParams(req);
  const grantType = params.get('grant_type');

  if (grantType === 'authorization_code') {
    return handleAuthorizationCodeGrant(params);
  }
  if (grantType === 'refresh_token') {
    return handleRefreshTokenGrant(params);
  }
  return json({ error: 'unsupported_grant_type' }, 400);
}

async function handleAuthorizationCodeGrant(params: URLSearchParams): Promise<Response> {
  const code = params.get('code');
  const redirect_uri = params.get('redirect_uri');
  const client_id = params.get('client_id');
  const code_verifier = params.get('code_verifier') || undefined;

  if (!code || !redirect_uri || !client_id) {
    return json({ error: 'invalid_request' }, 400);
  }

  const consumed = await consumeAuthorizationCode(code);
  if (!consumed) {
    return json(
      { error: 'invalid_grant', error_description: 'Kode otorisasi tidak valid, sudah dipakai, atau kedaluwarsa.' },
      400
    );
  }

  if (consumed.client_id !== client_id || consumed.redirect_uri !== redirect_uri) {
    return json({ error: 'invalid_grant', error_description: 'client_id atau redirect_uri tidak cocok.' }, 400);
  }

  if (!verifyPkce(code_verifier, consumed.code_challenge, consumed.code_challenge_method)) {
    return json({ error: 'invalid_grant', error_description: 'Verifikasi PKCE gagal.' }, 400);
  }

  const authOk = await verifyClientAuth(client_id, params);
  if (!authOk) {
    return json({ error: 'invalid_client' }, 401);
  }

  const tokens = await issueTokens({
    client_id,
    supabase_user_id: consumed.supabase_user_id,
    supabase_refresh_token: consumed.supabase_refresh_token,
  });

  return json({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: 'Bearer',
    expires_in: tokens.expires_in,
  });
}

async function handleRefreshTokenGrant(params: URLSearchParams): Promise<Response> {
  const refresh_token = params.get('refresh_token');
  const client_id = params.get('client_id');
  if (!refresh_token) {
    return json({ error: 'invalid_request' }, 400);
  }

  const rotated = await rotateAccessToken(refresh_token);
  if (!rotated) {
    return json({ error: 'invalid_grant' }, 400);
  }

  if (client_id && rotated.client_id !== client_id) {
    return json({ error: 'invalid_grant' }, 400);
  }

  const authOk = await verifyClientAuth(rotated.client_id, params);
  if (!authOk) {
    return json({ error: 'invalid_client' }, 401);
  }

  return json({
    access_token: rotated.access_token,
    refresh_token: rotated.refresh_token,
    token_type: 'Bearer',
    expires_in: rotated.expires_in,
  });
}

async function verifyClientAuth(client_id: string, params: URLSearchParams): Promise<boolean> {
  const client = await getClient(client_id);
  if (!client) return false;
  if (client.token_endpoint_auth_method === 'none' || !client.client_secret_hash) {
    return true; // public client — PKCE already covers the code grant's proof-of-possession
  }
  const providedSecret = params.get('client_secret');
  if (!providedSecret) return false;
  return hashToken(providedSecret) === client.client_secret_hash;
}

async function readParams(req: Request): Promise<URLSearchParams> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return new URLSearchParams(Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
  }
  const text = await req.text();
  return new URLSearchParams(text);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
