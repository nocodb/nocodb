/**
 * Placeholder returned in place of secret config values in API responses.
 * Update flows treat an incoming value that exactly equals this sentinel as
 * "unchanged" and restore the stored value (host-side
 * `restoreMaskedConfigValues`) — so the sentinel must never be persisted.
 */
export const CREDENTIAL_MASK = '********';

/**
 * Mask helper for `AuthIntegration.maskConfig()` implementations: returns the
 * sentinel when a value is present, passes empty values through untouched (so
 * a masked read still shows WHICH secrets are configured).
 */
export function maskSecret<T>(value: T): T | typeof CREDENTIAL_MASK {
  if (value === undefined || value === null || value === '') return value;
  return CREDENTIAL_MASK;
}
