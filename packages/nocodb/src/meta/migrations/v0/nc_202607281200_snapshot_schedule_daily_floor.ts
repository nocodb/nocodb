import { Logger } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_202607281200_snapshot_schedule_daily_floor');

// Hour the converted schedules land on — the product default for a daily
// snapshot (SNAPSHOT_SCHEDULE_DEFAULTS.config.time is '02:00').
const DAILY_FALLBACK_HOUR = 2;
const DAILY_FALLBACK_HOUR_LABEL = String(DAILY_FALLBACK_HOUR).padStart(2, '0');

/** Minute-of-the-hour the removed `hourly` preset stored, or 0 if unusable. */
const parseMinute = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 0;
  if (value < 0 || value > 59) return 0;

  return value;
};

/**
 * Periodic snapshots are now capped at one run per calendar day, and the
 * `hourly` frequency preset was removed with it. Rows written by earlier
 * versions can still carry `frequency = 'hourly'`, and nothing re-derives a
 * stored schedule at run time — the poller advances straight off
 * `cron_expression` — so those rows would keep firing hourly forever while
 * every save path rejected them as an unsupported frequency, leaving their
 * owner unable to edit or even switch them off.
 *
 * Convert each one to the equivalent daily schedule, keeping the minute the
 * user picked, and re-derive `cron_expression` / `next_run_at` so the poller
 * follows the new cadence immediately. Disabled rows keep a null next_run_at
 * (that is what `enabled = false` looks like); enabled rows get their next
 * occurrence in the schedule's own timezone.
 *
 * Custom cron rows tighter than a day are deliberately left untouched:
 * rewriting an expression the user wrote by hand is more intrusive than
 * grandfathering it, the cap is enforced from here on for every save, and such
 * a row can now be disabled or corrected in place.
 */
const up = async (knex: Knex) => {
  const rows = await knex(MetaTable.SNAPSHOT_SCHEDULE).where(
    'frequency',
    'hourly',
  );

  for (const row of rows) {
    const config =
      (typeof row.config === 'string'
        ? JSON.parse(row.config || '{}')
        : row.config) ?? {};

    const minute = parseMinute(config.minute);
    const cronExpression = `${minute} ${DAILY_FALLBACK_HOUR} * * *`;

    let nextRunAt: string | null = null;

    if (row.enabled) {
      try {
        nextRunAt = CronExpressionParser.parse(cronExpression, {
          tz: row.timezone || 'UTC',
        })
          .next()
          .toISOString();
      } catch (e) {
        // A stored timezone the runtime no longer recognises: leave the row
        // enabled with no next run rather than failing the whole migration.
        // The next save recomputes it.
        logger.warn(
          `Could not compute next run for snapshot schedule ${row.id}: ${
            (e as Error).message
          }`,
        );
      }
    }

    const time = `${DAILY_FALLBACK_HOUR_LABEL}:${String(minute).padStart(
      2,
      '0',
    )}`;

    await knex(MetaTable.SNAPSHOT_SCHEDULE)
      .where('id', row.id)
      .update({
        frequency: 'daily',
        config: JSON.stringify({ time }),
        cron_expression: cronExpression,
        next_run_at: nextRunAt,
      });
  }

  if (rows.length) {
    logger.log(
      `Converted ${rows.length} hourly snapshot schedule(s) to daily at ` +
        `${DAILY_FALLBACK_HOUR_LABEL}:mm.`,
    );
  }
};

const down = async (_knex: Knex) => {
  // One-way: the `hourly` preset no longer exists, so there is nothing valid to
  // restore these rows to. No-op to keep knex migration state consistent.
};

export { up, down };
