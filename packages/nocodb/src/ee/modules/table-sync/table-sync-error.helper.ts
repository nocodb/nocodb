import { NcBaseError } from 'nocodb-sdk';
import type { ClientType, NcContext } from 'nocodb-sdk';
import { extractDBError } from '~/helpers/catchError';

/**
 * Turn any thrown error into a business-friendly message for the user-facing
 * `TableSync.last_error` column (rendered in the UI). Mirrors the global
 * exception filter's precedence:
 *   1. Our own `NcError` (NcBaseError) — message is already user-facing.
 *   2. A recognised DB error — run it through the DB error extractor so a raw
 *      Postgres/MySQL error becomes a readable message (no SQL, no stack).
 *   3. Anything else — collapse to a generic message so internal details
 *      (raw SQL, stack traces) never leak to the UI.
 *
 * Callers should still log the raw error separately for debugging.
 */
export function toUserFacingSyncError(
  e: unknown,
  context?: NcContext & { clientType?: ClientType },
): string {
  if (e instanceof NcBaseError) {
    return (e.message || 'Sync failed').slice(0, 1000);
  }

  const dbError = extractDBError(e, context);
  if (dbError?.message) {
    return dbError.message.slice(0, 1000);
  }

  return 'Sync failed due to an unexpected error.';
}
