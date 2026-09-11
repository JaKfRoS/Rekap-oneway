import { getPublicOrigin, metadataCorsOptionsRequestHandler } from 'mcp-handler';

const corsOptions = metadataCorsOptionsRequestHandler();

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return corsOptions();
  }

  const origin = getPublicOrigin(req);

  const metadata = {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
  };

  return new Response(JSON.stringify(metadata), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
