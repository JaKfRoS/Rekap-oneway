import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { registerKasUsahaTools } from './_lib/tools';
import { resolveUserSession } from './_lib/userSession';

const handler = createMcpHandler(
  (server) => {
    registerKasUsahaTools(server);
  },
  {
    serverInfo: { name: 'kasusaha', version: '1.0.0' },
  }
);

const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const session = await resolveUserSession(bearerToken);
  if (!session) return undefined;

  return {
    token: bearerToken,
    clientId: session.userId,
    scopes: ['kasusaha:full'],
    extra: { userId: session.userId, supabaseAccessToken: session.supabaseAccessToken },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export default authHandler;
