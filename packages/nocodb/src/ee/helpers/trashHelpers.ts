import { PlanLimitTypes } from 'nocodb-sdk';
import { parseTrashRetentionEnv } from 'src/helpers/trashHelpers';
import type { NcContext } from 'nocodb-sdk';
import { getLimit } from '~/helpers/paymentHelpers';

export {
  computeCleanupDueAt,
  parseTrashRetentionEnv,
} from 'src/helpers/trashHelpers';

// -1 = infinite (cleanup_due_at NULL); 0 = disabled; >0 = retention days.

function parsePlan(limit: number | undefined | null): number | null {
  if (limit === Infinity) return -1;
  if (limit === 0) return 0;
  if (typeof limit === 'number' && limit > 0) return limit;
  return null;
}

export async function resolveTrashRetentionDays(
  context: Pick<NcContext, 'workspace_id'>,
  opts: {
    source: 'record' | 'base';
    model?: { trash_retention_days?: number | null };
  },
): Promise<number> {
  if (
    opts.source === 'record' &&
    opts.model?.trash_retention_days != null &&
    opts.model.trash_retention_days > 0
  ) {
    return opts.model.trash_retention_days;
  }

  const env =
    opts.source === 'record'
      ? process.env.NC_RECORD_TRASH_RETENTION_DAYS
      : process.env.NC_BASE_TRASH_RETENTION_DAYS;
  const fromEnv = parseTrashRetentionEnv(env);
  if (fromEnv !== null) return fromEnv;

  if (context.workspace_id) {
    try {
      const { limit } = await getLimit(
        PlanLimitTypes.LIMIT_TRASH_RETENTION,
        context.workspace_id,
      );
      const fromPlan = parsePlan(limit);
      if (fromPlan !== null) return fromPlan;
    } catch {
      // Workspace lookup failed — fall through.
    }
  }

  return 30;
}

/**
 * Trash event identity.
 *
 * An "event" is the set of soft-deleted rows that share the same deleter +
 * soft-delete timestamp. The bulkAll delete path captures one `now()` per
 * invocation and stamps every affected row with it (see delete.ts), so rows
 * deleted in one operation collapse into a single group on
 * `(LastModifiedBy, LastModifiedTime)`.
 *
 * The event id on the wire is `${fk_user_id ?? ''}::${deletedAt ISO string}`.
 * Empty fk_user_id represents a row whose LastModifiedBy is NULL (e.g. deleted
 * by a system path without a user, or predating the LMB column).
 */
export function encodeEventId(
  fkUserId: string | null | undefined,
  deletedAtIso: string,
): string {
  return `${fkUserId ?? ''}::${deletedAtIso}`;
}

export function decodeEventId(
  eventId: string,
): { fkUserId: string | null; deletedAt: Date } | null {
  if (!eventId) return null;
  const idx = eventId.indexOf('::');
  if (idx < 0) return null;
  const rawUser = eventId.slice(0, idx);
  const rawDate = eventId.slice(idx + 2);
  if (!rawDate) return null;
  const deletedAt = new Date(rawDate);
  if (isNaN(deletedAt.getTime())) return null;
  return { fkUserId: rawUser === '' ? null : rawUser, deletedAt };
}

/** Normalize a DB-returned timestamp (Date or string) to an ISO string. */
export function toIsoString(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Pagination cursor — keyset on (LastModifiedTime, LastModifiedBy) so new
 * deletes arriving at the top never shift ranks between pages. Format:
 * `${lmtIso}::${lmbOrEmpty}`. Empty lmb segment represents NULL LastModifiedBy.
 */
export function encodeCursor(
  lmtIso: string,
  fkUserId: string | null | undefined,
): string {
  return `${lmtIso}::${fkUserId ?? ''}`;
}

export function decodeCursor(
  cursor: string | undefined | null,
): { lmt: Date; lmb: string } | null {
  if (!cursor) return null;
  const idx = cursor.indexOf('::');
  if (idx < 0) return null;
  const rawLmt = cursor.slice(0, idx);
  const rawLmb = cursor.slice(idx + 2);
  if (!rawLmt) return null;
  const lmt = new Date(rawLmt);
  if (isNaN(lmt.getTime())) return null;
  return { lmt, lmb: rawLmb };
}
