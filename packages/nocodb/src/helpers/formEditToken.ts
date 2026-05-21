import crypto from 'crypto';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';

/**
 * HMAC-signed tokens that authorize editing a single record via a shared
 * form view. The payload `{ r, c, v }` encodes the row primary key, the
 * button column id (for audit / future grants), and the form view's uuid;
 * the signature binds all three to this server's JWT secret.
 *
 * Design notes:
 * - No explicit expiry. "Revocation" happens implicitly when the form view
 *   is unshared (uuid is rotated or cleared) — any outstanding token with
 *   an old uuid fails the `v` check at verify time.
 * - The salt is a constant string so tokens minted for other purposes
 *   (password reset, invites) can't be cross-used even if they happen to
 *   share payload shape.
 * - `timingSafeEqual` is used on the signature comparison to prevent
 *   timing side-channels.
 */
const SALT = 'nc-form-edit-row';

function getSecret(): string {
  const secret = Noco.getConfig()?.auth?.jwt?.secret;
  if (!secret) {
    NcError.badRequest('Server secret not configured');
  }
  return secret;
}

export function generateFormEditToken(
  rowPk: string,
  columnId: string,
  viewUuid: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ r: rowPk, c: columnId, v: viewUuid }),
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(`${SALT}:${payload}`)
    .digest('base64url');

  return `${payload}.${signature}`;
}

export function verifyFormEditToken(
  token: string,
  expectedViewUuid: string,
): { rowPk: string; columnId: string; viewUuid: string } {
  const parts = token.split('.');
  if (parts.length !== 2) {
    NcError.badRequest('Invalid edit token format');
  }

  const [payload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', getSecret())
    .update(`${SALT}:${payload}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedSigBuf = Buffer.from(expectedSignature);

  if (
    sigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedSigBuf)
  ) {
    NcError.badRequest('Invalid edit token');
  }

  let decoded: { r: string; c: string; v: string };
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    NcError.badRequest('Invalid edit token payload');
  }

  if (decoded.v !== expectedViewUuid) {
    NcError.badRequest('Edit token does not match this view');
  }

  return {
    rowPk: decoded.r,
    columnId: decoded.c,
    viewUuid: decoded.v,
  };
}
