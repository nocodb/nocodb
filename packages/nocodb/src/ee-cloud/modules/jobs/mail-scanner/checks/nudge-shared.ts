import dayjs from 'dayjs';
import { MailEvent } from '~/interface/Mail';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

/**
 * Windows applied to every nudge query.
 *
 * - `MIN_AGE_*` is the earliest a user can be nudged (let them try first).
 * - `MAX_AGE_*` is the latest — older cohorts are presumed disengaged and we
 *   don't retroactively spam them. Critical for an ~2-year-old cloud.
 * - `ACTIVE_WINDOW_DAYS` requires the user to have actually used the product
 *   in the last 30 days (via `nc_users_v2.last_active_at`). NULL is rejected
 *   so invited-but-never-signed-in users are never nudged.
 * - `CROSS_NUDGE_MUTE_DAYS` enforces at most one nudge from this family per
 *   user per 7 days regardless of event.
 */
export const NUDGE_MIN_AGE_NO_BASE_DAYS = 3;
export const NUDGE_MAX_AGE_NO_BASE_DAYS = 7;

export const NUDGE_MIN_AGE_WORKFLOW_HOURS = 24;
export const NUDGE_MAX_AGE_WORKFLOW_DAYS = 7;

export const NUDGE_MIN_AGE_INVITE_DAYS = 7;
export const NUDGE_MAX_AGE_INVITE_DAYS = 14;

export const NUDGE_ACTIVE_WINDOW_DAYS = 30;
export const CROSS_NUDGE_MUTE_DAYS = 7;

const NUDGE_EVENTS: ReadonlyArray<MailEvent> = [
  MailEvent.NUDGE_NO_BASE,
  MailEvent.NUDGE_WORKFLOW_INACTIVE,
  MailEvent.NUDGE_INVITE_TEAM,
  MailEvent.NUDGE_SEAT_LIMIT,
];

/**
 * Returns the set of user IDs that have received any nudge in the last
 * `CROSS_NUDGE_MUTE_DAYS`. Callers should skip these users for *all* nudge
 * checks in the current scanner tick.
 *
 * One batched query per check.run() — cheaper than per-user dedupe lookups.
 */
export async function loadRecentNudgeUserIds(
  ncMeta = Noco.ncMeta,
): Promise<Set<string>> {
  const since = dayjs.utc().subtract(CROSS_NUDGE_MUTE_DAYS, 'day').toDate();
  const rows = await ncMeta
    .knexConnection(MetaTable.MAIL_SENDS)
    .select('fk_user_id')
    .whereIn('event', NUDGE_EVENTS as string[])
    .whereNotNull('fk_user_id')
    .andWhere('created_at', '>', since);

  return new Set(rows.map((r: { fk_user_id: string }) => r.fk_user_id));
}
