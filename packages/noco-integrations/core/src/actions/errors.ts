/**
 * Fixed, client-safe labels for connection-layer failures. Labels are chosen
 * only from the driver error code, never copied from driver text, so no host,
 * IP, port, username or credential can reach the caller.
 */

/** Node TLS verification failures. */
export const INFRA_TLS_ERROR_CODES: ReadonlySet<string> = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_UNTRUSTED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

const AUTH_ERROR_CODES = new Set([
  '28000',
  '28P01',
  'ELOGIN',
  'ER_ACCESS_DENIED_ERROR',
  'ER_ACCESS_DENIED_NO_PASSWORD_ERROR',
]);

const REFUSED_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EHOSTDOWN',
]);

const HOST_NOT_FOUND_ERROR_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN']);

const TIMEOUT_ERROR_CODES = new Set(['ETIMEDOUT', 'ETIMEOUT']);

function errCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const c = (e as { code?: unknown }).code;
    return typeof c === 'string' ? c : '';
  }
  return '';
}

/** Fixed label for a known connection-layer failure, or undefined. */
export function infraFailureLabel(e: unknown): string | undefined {
  const code = errCode(e);
  if (!code) return undefined;
  if (INFRA_TLS_ERROR_CODES.has(code)) return 'certificate not trusted';
  if (AUTH_ERROR_CODES.has(code)) return 'authentication failed';
  if (REFUSED_ERROR_CODES.has(code)) return 'connection refused';
  if (HOST_NOT_FOUND_ERROR_CODES.has(code)) return 'host not found';
  if (TIMEOUT_ERROR_CODES.has(code)) return 'timeout';
  return undefined;
}

export function connectionFailedMessage(label: string): string {
  return `Connection failed: ${label}`;
}
