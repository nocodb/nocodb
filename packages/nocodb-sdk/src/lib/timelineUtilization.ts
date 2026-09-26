/**
 * Timeline "Utilization" summary — allocated hours ÷ available hours per
 * resource, per visible time bucket.
 *
 * Everything is normalised to a per-day amount and summed over the days of a
 * bucket, so a weekly rate on a task that covers three days of a week adds
 * 3/7 (or 3/5 with a Monday–Friday working week) of that rate to the week.
 */

import type { DateAxisSummaryConfig } from './interface/pageConfigs';

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
  /** Weekdays that count (0 = Sunday … 6 = Saturday). Absent → every day. */
  working_days?: number[] | null;
  multiple_resources?: UtilizationMultiResourceMode;
  time_off?: UtilizationTimeOffConfig | null;
  color_conditions?: UtilizationColorCondition[];
  default_color?: UtilizationColor;
}

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export const MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5];

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

/** Weekday mask (index = weekday); an empty or absent list counts every day. */
export function workingDayMask(workingDays?: number[] | null): boolean[] {
  const days = (workingDays ?? []).filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6
  );
  const set = new Set(days.length ? days : ALL_WEEKDAYS);
  return ALL_WEEKDAYS.map((d) => set.has(d));
}

export function isCountedDay(day: number, mask: boolean[]): boolean {
  return mask[dayNumberWeekday(day)];
}

/** Share of a recurring rate that falls on one counted day. */
export function perDayFactor(
  rate: UtilizationAvailableRate | Exclude<UtilizationAllocatedRate, 'total'>,
  mask: boolean[]
): number {
  const perWeek = mask.filter(Boolean).length || 7;
  switch (rate) {
    case 'day':
      return 1;
    case 'week':
      return 1 / perWeek;
    case 'month':
      // 12 months over the year's counted days (52 weeks + a day).
      return 12 / ((365 / 7) * perWeek);
  }
  return 0;
}

export function countCountedDays(
  fromDay: number,
  toDay: number,
  mask: boolean[]
): number {
  if (toDay < fromDay) return 0;
  const total = toDay - fromDay + 1;
  const perWeek = mask.filter(Boolean).length;
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * perWeek;
  for (let d = fromDay + fullWeeks * 7; d <= toDay; d++) {
    if (isCountedDay(d, mask)) count++;
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
  /** Weekdays that count; absent → every day. */
  workingDays?: number[] | null;
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
  params: ComputeUtilizationParams
): ComputeUtilizationResult {
  const { buckets } = params;
  const mask = workingDayMask(params.workingDays);

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

  // day offset → bucket index, and whether the day counts at all
  const bucketOfDay = new Int32Array(dayCount).fill(-1);
  buckets.forEach((b, i) => {
    for (let d = Math.max(b.startDay, windowStart); d < b.endDay; d++) {
      bucketOfDay[d - windowStart] = i;
    }
  });
  const counted = new Uint8Array(dayCount);
  for (let i = 0; i < dayCount; i++) {
    counted[i] = isCountedDay(windowStart + i, mask) ? 1 : 0;
  }

  // Spans are added as difference arrays (+ at the first day, − after the
  // last) and summed in one pass per resource, so cost is O(tasks + days)
  // per resource rather than O(tasks × span).
  interface ResourceAcc {
    allocated: Float64Array;
    work: Int32Array;
    off: Int32Array | null;
    capacity: number | null;
  }

  const byResource = new Map<string, ResourceAcc>();
  const accFor = (key: string) => {
    let acc = byResource.get(key);
    if (!acc) {
      acc = {
        allocated: new Float64Array(dayCount + 1),
        work: new Int32Array(dayCount + 1),
        off: null,
        capacity: null,
      };
      byResource.set(key, acc);
    }
    return acc;
  };

  const allocFactor =
    params.allocatedRate === 'total'
      ? null
      : perDayFactor(params.allocatedRate, mask);

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
      const days = countCountedDays(fromDay, toDay, mask);
      perDay = days ? allocated / days : 0;
    } else {
      perDay = allocated * allocFactor;
    }
    perDay *= share;

    const from = Math.max(fromDay, windowStart) - windowStart;
    const to = Math.min(toDay, windowEnd - 1) - windowStart;
    const taskCapacity = Number(task.available);
    const hasCapacity =
      task.available !== null &&
      task.available !== undefined &&
      Number.isFinite(taskCapacity);

    for (const key of resources) {
      const acc = accFor(key);
      if (hasCapacity) {
        acc.capacity = Math.max(acc.capacity ?? 0, taskCapacity);
      }
      if (to < from) continue;
      acc.allocated[from] += perDay;
      acc.allocated[to + 1] -= perDay;
      acc.work[from] += 1;
      acc.work[to + 1] -= 1;
    }
  }

  for (const t of params.timeOff ?? []) {
    const acc = t.resource ? byResource.get(t.resource) : undefined;
    if (!acc) continue;
    const from = Math.max(t.fromDay, windowStart) - windowStart;
    const to =
      Math.min(Math.max(t.toDay ?? t.fromDay, t.fromDay), windowEnd - 1) -
      windowStart;
    if (to < from) continue;
    if (!acc.off) acc.off = new Int32Array(dayCount + 1);
    acc.off[from] += 1;
    acc.off[to + 1] -= 1;
  }

  const capFactor = perDayFactor(params.availableRate, mask);
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
    const groupBuckets = buckets.map(() => ({
      allocated: 0,
      available: 0,
      time_off: 0,
    }));
    const total = { allocated: 0, available: 0, time_off: 0 };

    let allocated = 0;
    let work = 0;
    let off = 0;
    for (let i = 0; i < dayCount; i++) {
      allocated += acc.allocated[i];
      work += acc.work[i];
      if (acc.off) off += acc.off[i];
      const b = bucketOfDay[i];
      if (b < 0) continue;
      const cell = groupBuckets[b];
      if (counted[i]) {
        cell.allocated += allocated;
        if (off <= 0) cell.available += capacityPerDay;
      }
      if (off > 0 && work > 0) cell.time_off++;
    }

    groupBuckets.forEach((cell, i) => {
      // Difference-array sums can leave float dust around zero.
      cell.allocated = round(Math.max(cell.allocated, 0));
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
  value?: Partial<UtilizationValue> | null
): number | null {
  const allocated = Number(value?.allocated) || 0;
  const available = Number(value?.available) || 0;
  if (available <= 0) return allocated > 0 ? Infinity : null;
  return (allocated / available) * 100;
}

export function utilizationColor(
  percent: number | null,
  conditions: UtilizationColorCondition[] = UTILIZATION_DEFAULT_COLOR_CONDITIONS,
  defaultColor: UtilizationColor = UTILIZATION_DEFAULT_COLOR
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

/**
 * Re-points a saved date-axis summary at another copy of the base (duplicate
 * / import). Returns `undefined` when a field it needs has no counterpart;
 * time off is dropped alone when only its table or fields are missing.
 */
export function remapDateAxisSummaryIds(
  summary: DateAxisSummaryConfig | undefined | null,
  mapId: (id: string) => string | undefined | null
): DateAxisSummaryConfig | undefined {
  if (!summary?.fk_column_id) return undefined;
  const fkColumnId = mapId(summary.fk_column_id);
  if (!fkColumnId) return undefined;

  const next: DateAxisSummaryConfig = { ...summary, fk_column_id: fkColumnId };
  const util = summary.utilization;
  if (!util) return next;

  const resource = util.fk_resource_column_id
    ? mapId(util.fk_resource_column_id)
    : undefined;
  if (!resource) return undefined;

  let available: string | null = null;
  if (util.fk_available_column_id) {
    available = mapId(util.fk_available_column_id) ?? null;
    if (!available) return undefined;
  }

  let timeOff: UtilizationTimeOffConfig | null = null;
  if (util.time_off) {
    const off = util.time_off;
    const model = mapId(off.fk_model_id);
    const link = mapId(off.fk_link_column_id);
    const start = mapId(off.fk_start_column_id);
    const end = off.fk_end_column_id ? mapId(off.fk_end_column_id) : null;
    timeOff =
      model && link && start && (!off.fk_end_column_id || end)
        ? {
            ...off,
            fk_model_id: model,
            fk_link_column_id: link,
            fk_start_column_id: start,
            fk_end_column_id: end,
          }
        : null;
  }

  next.utilization = {
    ...util,
    fk_resource_column_id: resource,
    fk_available_column_id: available,
    time_off: timeOff,
  };
  return next;
}
