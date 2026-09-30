import { NcBaseError } from 'nocodb-sdk';

/**
 * Marks a consent failure as being about *what was requested* rather than how
 * the request was formed, so the authorize endpoint can answer RFC 6749
 * §4.1.2.1 `invalid_scope` without pattern-matching on message text.
 */
export class OAuthInvalidScopeError extends NcBaseError {}

/** Runs `fn`, re-flagging any validation rejection as an invalid-scope one. */
export async function asInvalidScope<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NcBaseError) throw new OAuthInvalidScopeError(e.message);
    throw e;
  }
}
