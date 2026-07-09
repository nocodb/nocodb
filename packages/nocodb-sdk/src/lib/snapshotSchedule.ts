export enum SnapshotScheduleFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CRON = 'cron',
}

export interface SnapshotScheduleConfig {
  /** Minute of the hour (hourly) */
  minute?: number;
  /** Time of day HH:mm (daily/weekly/monthly) */
  time?: string;
  /** Day of week 0-6, Sunday=0 (weekly) */
  dayOfWeek?: number;
  /** Day of month 1-31 (monthly) */
  dayOfMonth?: number;
  /** Custom cron expression (cron frequency) */
  cron?: string;
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
    case SnapshotScheduleFrequency.HOURLY: {
      const minute = config.minute ?? 0;
      if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
      return `${minute} * * * *`;
    }
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
