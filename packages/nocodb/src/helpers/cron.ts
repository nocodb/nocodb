import { CronExpressionParser } from 'cron-parser';

/**
 * Cron parsing shared by every scheduled feature — agents, workflows, syncs,
 * snapshots. Each of those owns its own *policy* (how often is too often, what
 * a missed window means); this only owns the parsing and the arithmetic.
 */

export interface CronValidationResult {
  valid: boolean;
  message?: string;
  /** First fire time at or after `from`, when the expression is valid. */
  nextRun?: Date;
}

export interface CronOptions {
  timezone?: string;
  /** Clock the expression is evaluated against. Defaults to now. */
  from?: Date;
  /**
   * Reject schedules that fire faster than this. Left unset there is no floor —
   * a caller that charges per run (agents) sets one, a caller that does not
   * (snapshots) need not.
   */
  minIntervalMs?: number;
}

/**
 * Validate a cron expression and compute its next fire time.
 *
 * Never throws: an unparseable expression is a `valid: false` result with the
 * parser's own message, because every caller is validating user input rather
 * than asserting an invariant.
 */
export function validateCronExpression(
  expression?: string,
  opts: CronOptions = {},
): CronValidationResult {
  if (!expression?.trim()) {
    return { valid: false, message: 'expression is empty' };
  }

  const { timezone, from = new Date(), minIntervalMs } = opts;

  try {
    const interval = CronExpressionParser.parse(expression.trim(), {
      currentDate: from,
      ...(timezone ? { tz: timezone } : {}),
    });

    const first = interval.next().toDate();

    if (minIntervalMs) {
      // The gap to the *following* run is what reveals the real frequency —
      // the first run alone says nothing about how often it repeats.
      const second = interval.next().toDate();

      if (second.getTime() - first.getTime() < minIntervalMs) {
        return {
          valid: false,
          message: `schedule fires more often than every ${Math.round(
            minIntervalMs / 1000,
          )}s`,
        };
      }
    }

    return { valid: true, nextRun: first };
  } catch (e) {
    return { valid: false, message: e?.message || 'unparseable' };
  }
}

/**
 * Next fire time after `from`, or null if the expression is unusable.
 * Used by schedulers to advance their own `next_run_at` after a firing.
 *
 * A missed window is skipped rather than backfilled — waking up to a burst of
 * catch-up runs is worse than missing one.
 */
export function nextCronRun(
  expression?: string,
  opts: CronOptions = {},
): Date | null {
  const { valid, nextRun } = validateCronExpression(expression, opts);
  return valid ? nextRun ?? null : null;
}
