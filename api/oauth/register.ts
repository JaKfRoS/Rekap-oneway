import { registerClient } from '../_lib/oauthStore';

/**
 * Dynamic Client Registration (RFC 7591) — lets Claude.ai (or any MCP
 * client) register itself as an OAuth client automatically when the user
 * adds this server as a custom connector, instead of us hard-coding a
 * client_id in advance.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_request', error_description: 'Body harus JSON.' }, 400);
  }

  const redirectUris: string[] = Array.isArray(body?.redirect_uris)
    ? body.redirect_uris.filter((u: unknown): u is string => typeof u === 'string')
    : [];

  if (redirectUris.length === 0) {
    return json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris wajib diisi.' }, 400);
  }

  const tokenEndpointAuthMethod =
    typeof body?.token_endpoint_auth_method === 'string' ? body.token_endpoint_auth_method : undefined;

  try {
    const { client_id, client_secret } = await registerClient({
      clientName: typeof body?.client_name === 'string' ? body.client_name : undefined,
      redirectUris,
      tokenEndpointAuthMethod,
    });

    return json(
      {
        client_id,
        ...(client_secret ? { client_secret } : {}),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: redirectUris,
        token_endpoint_auth_method: client_secret ? tokenEndpointAuthMethod || 'client_secret_post' : 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      },
      201
    );
  } catch (err: any) {
    return json({ error: 'server_error', error_description: err?.message || String(err) }, 500);
  }
}

function json(body: unknown, status: number): Response {
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
