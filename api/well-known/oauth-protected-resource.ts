import { protectedResourceHandler, metadataCorsOptionsRequestHandler, getPublicOrigin } from 'mcp-handler';

const corsOptions = metadataCorsOptionsRequestHandler();

export default function handler(req: Request): Response | Promise<Response> {
  if (req.method === 'OPTIONS') {
    return corsOptions();
  }

  const origin = getPublicOrigin(req);
  return protectedResourceHandler({ authServerUrls: [origin] })(req);
}
