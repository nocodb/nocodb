import type OAuthClient from '~/models/OAuthClient';

// Fields that must never be returned by the unauthenticated public OAuth client
// endpoint: the bcrypt client_secret, the RFC 7591 dynamic-registration
// management credentials, and the owner's internal user id.
export const SENSITIVE_OAUTH_CLIENT_FIELDS = [
  'client_secret',
  'registration_access_token',
  'registration_client_uri',
  'fk_user_id',
] as const;

/**
 * Strip sensitive fields from an OAuthClient record before returning it from the
 * unauthenticated public client endpoint. Returns a shallow copy — the input is
 * not mutated. Fixes GHSA-rmx6-f46x-5hhx.
 */
export function toPublicOAuthClient(client: OAuthClient): Partial<OAuthClient> {
  const sanitized: Partial<OAuthClient> = { ...client };
  for (const field of SENSITIVE_OAUTH_CLIENT_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}
