export enum SnapshotScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CRON = 'cron',
}

export interface SnapshotScheduleConfig {
  /** Time of day HH:mm (daily/weekly/monthly) */
  time?: string;
  /** Day of week 0-6, Sunday=0 (weekly) */
  dayOfWeek?: number;
  /** Day of month 1-31 (monthly) */
  dayOfMonth?: number;
  /** Custom cron expression (cron frequency) */
  cron?: string;
}

/**
 * Minimal shape of a schedule occurrence, resolved in the schedule's own
 * timezone. cron-parser's `CronDate` satisfies it structurally, which keeps
 * this module — and therefore the SDK — free of a cron dependency while the
 * rule itself stays in one place for both the client and the server.
 */
export interface SnapshotScheduleOccurrence {
  getTime(): number;
  getFullYear(): number;
  getMonth(): number;
  getDate(): number;
  getHours(): number;
  getMinutes(): number;
}

// How far ahead the once-per-day scan looks. Checking only the next pair of
// occurrences is time-of-day dependent (e.g. "0,30 2 * * *" inspected after
// 02:30 shows a ~24h first gap yet fires twice within 30 minutes every day),
// so scan a multi-week window bounded by an iteration cap for dense crons.
const SCAN_HORIZON_MS = 40 * 24 * 60 * 60 * 1000;
const SCAN_MAX_ITERATIONS = 400;

const isSameLocalDay = (
  a: SnapshotScheduleOccurrence,
  b: SnapshotScheduleOccurrence
) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isSameLocalTime = (
  a: SnapshotScheduleOccurrence,
  b: SnapshotScheduleOccurrence
) => a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();

/**
 * Periodic snapshots may run at most once per calendar day, evaluated in the
 * schedule's own timezone. True when the schedule breaks that cap anywhere in
 * the scan window. `nextOccurrence` is pulled lazily and must yield successive
 * occurrences; it is called at most SCAN_MAX_ITERATIONS + 1 times.
 *
 * The cap is expressed per calendar day rather than as a ">= 24h apart" gap
 * because no interval threshold separates the two 23h cases that matter: on a
 * DST spring-forward day the occurrence is displaced rather than skipped, so a
 * plain daily schedule genuinely runs 23h after the previous one, while a
 * day-restricted cron such as `0 0,23 * * 1` also runs 23h apart and has to be
 * rejected. For 5-field crons the per-day rule is exactly equivalent to a 24h
 * floor anyway: the minute x hour product fires identically on every selected
 * day, so more than one fire per day always produces a same-day pair, and
 * exactly one fire per day always leaves whole-day gaps.
 *
 * Enforced for custom cron expressions on both the client (inline warning) and
 * the server (rejected on save); the presets (daily/weekly/monthly) satisfy it
 * by construction.
 */
export function isSnapshotScheduleTooFrequent(
  nextOccurrence: () => SnapshotScheduleOccurrence
): boolean {
  let prev = nextOccurrence();
  const horizon = prev.getTime() + SCAN_HORIZON_MS;

  for (let i = 0; i < SCAN_MAX_ITERATIONS; i++) {
    const next = nextOccurrence();

    // Some DST transitions make cron-parser stall on a single instant
    // (Australia/Lord_Howe) — stop scanning rather than read a non-advancing
    // occurrence as a violation.
    if (next.getTime() <= prev.getTime()) break;

    // Two occurrences at the same local wall-clock time on one date are a DST
    // fall-back repeat (Antarctica/Troll shifts by 2h), not something the
    // schedule asked for: within a day the minute x hour product is distinct
    // by construction.
    if (isSameLocalDay(prev, next) && !isSameLocalTime(prev, next)) return true;

    prev = next;
    if (prev.getTime() > horizon) break;
  }

  return false;
}

export const SNAPSHOT_SCHEDULE_DEFAULTS = {
  frequency: SnapshotScheduleFrequency.DAILY,
  config: { time: '02:00' } as SnapshotScheduleConfig,
  keep_last: 30,
  delete_after_days: 90,
} as const;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Normalize a frequency + config pair into a standard 5-field cron
 * expression. Returns null when the config is invalid/incomplete —
 * callers surface that as a validation error.
 */
export function buildSnapshotScheduleCron(
  frequency: SnapshotScheduleFrequency | string,
  config: SnapshotScheduleConfig = {}
): string | null {
  const parseTime = (time?: string) => {
    const match = time?.match(TIME_RE);
    if (!match) return null;
    return { hour: +match[1], minute: +match[2] };
  };

  switch (frequency) {
    case SnapshotScheduleFrequency.DAILY: {
      const t = parseTime(config.time);
      if (!t) return null;
      return `${t.minute} ${t.hour} * * *`;
    }
    case SnapshotScheduleFrequency.WEEKLY: {
      const t = parseTime(config.time);
      const dow = config.dayOfWeek;
      if (!t || !Number.isInteger(dow) || dow < 0 || dow > 6) return null;
      return `${t.minute} ${t.hour} * * ${dow}`;
    }
    case SnapshotScheduleFrequency.MONTHLY: {
      const t = parseTime(config.time);
      const dom = config.dayOfMonth;
      if (!t || !Number.isInteger(dom) || dom < 1 || dom > 31) return null;
      return `${t.minute} ${t.hour} ${dom} * *`;
    }
    case SnapshotScheduleFrequency.CRON: {
      const cron = config.cron?.trim();
      if (!cron || cron.split(/\s+/).length !== 5) return null;
      return cron;
    }
    default:
      return null;
  }
}
