/**
 * Timeline "Utilization" summary — allocated hours ÷ available hours per
 * resource, per visible time bucket.
 *
 * Everything is normalised to a per-day amount and summed over the days of a
 * bucket, so a weekly rate on a task that covers three days of a week adds
 * 3/7 (or 3/5 with workdays only) of that rate to the week.
 */

export const UTILIZATION_AGGREGATION = 'utilization';

export type UtilizationAllocatedRate = 'total' | 'day' | 'week' | 'month';

export type UtilizationAvailableRate = 'day' | 'week' | 'month';

/** How a task assigned to several resources is counted. */
export type UtilizationMultiResourceMode = 'split' | 'full';

export type UtilizationColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'gray';

export interface UtilizationColorCondition {
  /** Applies when the percentage is >= this value. */
  gte: number;
  color: UtilizationColor;
}

export interface UtilizationTimeOffConfig {
  /** Table holding the time-off records. */
  fk_model_id: string;
  /** Link field on the time-off table pointing at the resource table. */
  fk_link_column_id: string;
  fk_start_column_id: string;
  /** Absent → each record is a single day. */
  fk_end_column_id?: string | null;
  label?: string;
}

export interface DateAxisUtilizationConfig {
  /** Rate of the allocated-hours field (`DateAxisSummaryConfig.fk_column_id`). */
  allocated_rate: UtilizationAllocatedRate;
  /** Link (belongs-to) or User field naming who does the work. */
  fk_resource_column_id: string;
  /** Field holding each resource's working hours (e.g. a lookup). */
  fk_available_column_id?: string | null;
  /** Fixed working hours, used when no field is picked. */
  available_value?: number | null;
  available_rate: UtilizationAvailableRate;
  /** Count Monday–Friday only. */
  workdays_only?: boolean;
  multiple_resources?: UtilizationMultiResourceMode;
  time_off?: UtilizationTimeOffConfig | null;
  color_conditions?: UtilizationColorCondition[];
  default_color?: UtilizationColor;
}

/** Per-bucket (or total) utilization cell returned by the server. */
export interface UtilizationValue {
  allocated: number;
  available: number;
  /** Days in the bucket that are time off and have work scheduled. */
  time_off?: number;
}

export const UTILIZATION_DEFAULT_COLOR_CONDITIONS: UtilizationColorCondition[] =
  [
    { gte: 100, color: 'red' },
    { gte: 75, color: 'orange' },
  ];

export const UTILIZATION_DEFAULT_COLOR: UtilizationColor = 'green';

export const UTILIZATION_DEFAULT_TIME_OFF_LABEL = 'PTO';

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 for a `YYYY-MM-DD` date. */
export function dateStringToDayNumber(value: string): number {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/**
 * Day number of an instant, in the timezone given by `offsetMinutes`
 * (minutes east of UTC).
 */
export function instantToDayNumber(ms: number, offsetMinutes: number): number {
  return Math.floor((ms + offsetMinutes * 60_000) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. 1970-01-01 was a Thursday. */
export function dayNumberWeekday(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

export function isCountedDay(day: number, workdaysOnly?: boolean): boolean {
  if (!workdaysOnly) return true;
  const wd = dayNumberWeekday(day);
  return wd !== 0 && wd !== 6;
}

/** Share of a recurring rate that falls on one counted day. */
export function perDayFactor(
  rate: UtilizationAvailableRate | Exclude<UtilizationAllocatedRate, 'total'>,
  workdaysOnly?: boolean,
): number {
  switch (rate) {
    case 'day':
      return 1;
    case 'week':
      return 1 / (workdaysOnly ? 5 : 7);
    case 'month':
      return 12 / (workdaysOnly ? 260 : 365);
  }
  return 0;
}

export function countCountedDays(
  fromDay: number,
  toDay: number,
  workdaysOnly?: boolean,
): number {
  if (toDay < fromDay) return 0;
  const total = toDay - fromDay + 1;
  if (!workdaysOnly) return total;
  let count = 0;
  const fullWeeks = Math.floor(total / 7);
  count += fullWeeks * 5;
  for (let d = fromDay + fullWeeks * 7; d <= toDay; d++) {
    if (isCountedDay(d, true)) count++;
  }
  return count;
}

export interface UtilizationTask {
  fromDay: number;
  /** Inclusive; defaults to `fromDay`. */
  toDay?: number | null;
  allocated: number;
  resources: string[];
  /** Working hours read from the task (lookup of the resource's capacity). */
  available?: number | null;
}

export interface UtilizationTimeOff {
  resource: string;
  fromDay: number;
  toDay?: number | null;
}

export interface UtilizationBucketDays {
  /** Inclusive. */
  startDay: number;
  /** Exclusive. */
  endDay: number;
}

export interface ComputeUtilizationParams {
  buckets: UtilizationBucketDays[];
  tasks: UtilizationTask[];
  timeOff?: UtilizationTimeOff[];
  allocatedRate: UtilizationAllocatedRate;
  availableRate: UtilizationAvailableRate;
  /** Working hours when a task carries none. */
  availableValue?: number | null;
  workdaysOnly?: boolean;
  multipleResources?: UtilizationMultiResourceMode;
}

export interface ComputeUtilizationResult {
  /** Across every resource, indexed to `buckets`. */
  buckets: UtilizationValue[];
  groups: Array<{
    key: string;
    total: UtilizationValue;
    buckets: UtilizationValue[];
  }>;
  grandTotal: UtilizationValue;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function computeUtilization(
  params: ComputeUtilizationParams,
): ComputeUtilizationResult {
  const { buckets, workdaysOnly } = params;

  const emptyResult = (): ComputeUtilizationResult => ({
    buckets: buckets.map(() => ({ allocated: 0, available: 0 })),
    groups: [],
    grandTotal: { allocated: 0, available: 0 },
  });

  if (!buckets.length) return emptyResult();

  const windowStart = buckets[0].startDay;
  const windowEnd = buckets[buckets.length - 1].endDay; // exclusive
  const dayCount = windowEnd - windowStart;
  if (dayCount <= 0) return emptyResult();

  // day offset → bucket index
  const bucketOfDay = new Int32Array(dayCount).fill(-1);
  buckets.forEach((b, i) => {
    for (let d = Math.max(b.startDay, windowStart); d < b.endDay; d++) {
      bucketOfDay[d - windowStart] = i;
    }
  });

  interface ResourceAcc {
    allocated: Float64Array;
    hasWork: Uint8Array;
    capacity: number | null;
  }

  const byResource = new Map<string, ResourceAcc>();
  const accFor = (key: string) => {
    let acc = byResource.get(key);
    if (!acc) {
      acc = {
        allocated: new Float64Array(dayCount),
        hasWork: new Uint8Array(dayCount),
        capacity: null,
      };
      byResource.set(key, acc);
    }
    return acc;
  };

  const allocFactor =
    params.allocatedRate === 'total'
      ? null
      : perDayFactor(params.allocatedRate, workdaysOnly);

  for (const task of params.tasks) {
    const resources = Array.from(new Set(task.resources.filter(Boolean)));
    if (!resources.length) continue;

    const fromDay = task.fromDay;
    const toDay = Math.max(task.toDay ?? fromDay, fromDay);
    const allocated = Number(task.allocated) || 0;
    const share =
      params.multipleResources === 'split' ? 1 / resources.length : 1;

    let perDay: number;
    if (allocFactor === null) {
      const counted = countCountedDays(fromDay, toDay, workdaysOnly);
      perDay = counted ? allocated / counted : 0;
    } else {
      perDay = allocated * allocFactor;
    }
    perDay *= share;

    const from = Math.max(fromDay, windowStart);
    const to = Math.min(toDay, windowEnd - 1);

    for (const key of resources) {
      const acc = accFor(key);
      const taskCapacity = Number(task.available);
      if (
        task.available !== null &&
        task.available !== undefined &&
        Number.isFinite(taskCapacity)
      ) {
        acc.capacity = Math.max(acc.capacity ?? 0, taskCapacity);
      }
      for (let d = from; d <= to; d++) {
        const off = d - windowStart;
        acc.hasWork[off] = 1;
        if (isCountedDay(d, workdaysOnly)) acc.allocated[off] += perDay;
      }
    }
  }

  const timeOffDays = new Map<string, Uint8Array>();
  for (const t of params.timeOff ?? []) {
    if (!t.resource || !byResource.has(t.resource)) continue;
    let days = timeOffDays.get(t.resource);
    if (!days) {
      days = new Uint8Array(dayCount);
      timeOffDays.set(t.resource, days);
    }
    const from = Math.max(t.fromDay, windowStart);
    const to = Math.min(
      Math.max(t.toDay ?? t.fromDay, t.fromDay),
      windowEnd - 1,
    );
    for (let d = from; d <= to; d++) days[d - windowStart] = 1;
  }

  const capFactor = perDayFactor(params.availableRate, workdaysOnly);
  const fallbackCapacity = Number(params.availableValue) || 0;

  const teamBuckets = buckets.map(() => ({
    allocated: 0,
    available: 0,
    time_off: 0,
  }));
  const grandTotal = { allocated: 0, available: 0, time_off: 0 };

  const groups: ComputeUtilizationResult['groups'] = [];

  for (const [key, acc] of byResource) {
    const capacityPerDay = (acc.capacity ?? fallbackCapacity) * capFactor;
    const off = timeOffDays.get(key);
    const groupBuckets = buckets.map(() => ({
      allocated: 0,
      available: 0,
      time_off: 0,
    }));
    const total = { allocated: 0, available: 0, time_off: 0 };

    for (let i = 0; i < dayCount; i++) {
      const b = bucketOfDay[i];
      if (b < 0) continue;
      const day = windowStart + i;
      const isOff = !!off?.[i];
      const available =
        isOff || !isCountedDay(day, workdaysOnly) ? 0 : capacityPerDay;
      const cell = groupBuckets[b];
      cell.allocated += acc.allocated[i];
      cell.available += available;
      if (isOff && acc.hasWork[i]) cell.time_off++;
    }

    groupBuckets.forEach((cell, i) => {
      cell.allocated = round(cell.allocated);
      cell.available = round(cell.available);
      total.allocated += cell.allocated;
      total.available += cell.available;
      total.time_off += cell.time_off;
      teamBuckets[i].allocated += cell.allocated;
      teamBuckets[i].available += cell.available;
      teamBuckets[i].time_off += cell.time_off;
    });

    total.allocated = round(total.allocated);
    total.available = round(total.available);
    grandTotal.allocated += total.allocated;
    grandTotal.available += total.available;
    grandTotal.time_off += total.time_off;

    groups.push({ key, total, buckets: groupBuckets });
  }

  return {
    buckets: teamBuckets.map((b) => ({
      ...b,
      allocated: round(b.allocated),
      available: round(b.available),
    })),
    groups,
    grandTotal: {
      ...grandTotal,
      allocated: round(grandTotal.allocated),
      available: round(grandTotal.available),
    },
  };
}

/**
 * `allocated ÷ available` as a percentage. `Infinity` when work is scheduled
 * while nothing is available; `null` when there is neither.
 */
export function utilizationPercent(
  value?: Partial<UtilizationValue> | null,
): number | null {
  const allocated = Number(value?.allocated) || 0;
  const available = Number(value?.available) || 0;
  if (available <= 0) return allocated > 0 ? Infinity : null;
  return (allocated / available) * 100;
}

export function utilizationColor(
  percent: number | null,
  conditions: UtilizationColorCondition[] = UTILIZATION_DEFAULT_COLOR_CONDITIONS,
  defaultColor: UtilizationColor = UTILIZATION_DEFAULT_COLOR,
): UtilizationColor | null {
  if (percent === null) return null;
  const match = [...conditions]
    .filter((c) => Number.isFinite(Number(c.gte)))
    .sort((a, b) => b.gte - a.gte)
    .find((c) => percent >= c.gte);
  return match?.color ?? defaultColor;
}

export function formatUtilizationPercent(percent: number | null): string {
  if (percent === null) return '';
  if (percent === Infinity) return '∞%';
  return `${Math.round(percent)}%`;
}
