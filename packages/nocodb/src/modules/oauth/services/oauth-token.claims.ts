export interface OAuthAccessTokenUser {
  id: string;
  email: string;
  // Optional to match the User model (`roles?: string`); the claim copies it through as-is.
  roles?: unknown;
  token_version?: string | number | null;
}

/**
 * Build the claims for an OAuth access token JWT.
 *
 * `is_oauth_token: true` is mandatory: OAuth access tokens are signed with the
 * first-party JWT secret, so without this marker JwtStrategy.validate() accepts
 * the token as an xc-auth session and bypasses the OAuth bearer restrictions.
 * Fixes GHSA-xmfr-pc8j-4xh5.
 */
export function buildOAuthAccessTokenClaims(params: {
  userId: string;
  clientId: string;
  scope?: string;
  user: OAuthAccessTokenUser;
  nowSeconds: number;
  expiresInSeconds: number;
}) {
  const { userId, clientId, scope, user, nowSeconds, expiresInSeconds } =
    params;
  return {
    sub: userId,
    email: user.email,
    client_id: clientId,
    scope,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
    id: user.id,
    roles: user.roles,
    token_version: user.token_version,
    is_oauth_token: true,
  };
}
