import { randomBytes, createHash } from 'node:crypto';

export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Verifies a PKCE code_verifier against the code_challenge stored at /authorize time. */
export function verifyPkce(
  codeVerifier: string | undefined,
  codeChallenge: string | null,
  codeChallengeMethod: string | null
): boolean {
  // No PKCE was used for this client/request — only acceptable if none was required.
  if (!codeChallenge) return true;
  if (!codeVerifier) return false;

  if (codeChallengeMethod === 'plain') {
    return codeVerifier === codeChallenge;
  }
  // Default / 'S256'
  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  return computed === codeChallenge;
}
