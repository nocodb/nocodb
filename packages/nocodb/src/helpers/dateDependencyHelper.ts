import { UITypes } from 'nocodb-sdk';
import type { Column } from '~/models';
import type DateDependency from '~/models/DateDependency';

function daysBetween(start: Date, end: Date, includeWeekends = true): number {
  if (includeWeekends) {
    return Math.round((end.getTime() - start.getTime()) / 86400_000);
  }

  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function addDays(date: Date, days: number, includeWeekends = true): Date {
  if (includeWeekends) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function subtractDays(date: Date, days: number, includeWeekends = true): Date {
  if (includeWeekends) {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  const result = new Date(date);
  let subtracted = 0;
  while (subtracted < days) {
    result.setDate(result.getDate() - 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) subtracted++;
  }
  return result;
}

/**
 * Given the incoming row data and the previous row state (oldData), calculates
 * which of start_date / end_date / duration is missing and fills it in-place on `data`.
 *
 * @param data     Mutable row payload (column_name keyed)
 * @param oldData  Previous row state (title keyed — same as prepareNocoData)
 * @param rule     The active DateDependency config
 * @param columns  All columns of the model
 */
export function applyDateDependencyFieldSync(
  data: Record<string, any>,
  oldData: Record<string, any> | null,
  rule: DateDependency,
  columns: Column[],
): void {
  if (!rule.is_active) return;

  const startCol = columns.find((c) => c.id === rule.fk_start_date_field_id);
  const endCol = columns.find((c) => c.id === rule.fk_end_date_field_id);
  const durCol = columns.find((c) => c.id === rule.fk_duration_field_id);

  if (!startCol || !endCol || !durCol) return;

  // data uses column_name keys; oldData uses title keys (prepareNocoData contract)
  const resolve = (col: Column): any => {
    if (col.column_name in data) return data[col.column_name];
    if (oldData && col.title in oldData) return oldData[col.title];
    return undefined;
  };

  const startVal = resolve(startCol);
  const endVal = resolve(endCol);
  const durVal = resolve(durCol);

  const inData = (col: Column) => col.column_name in data;

  const startPresent = startVal !== null && startVal !== undefined;
  const endPresent = endVal !== null && endVal !== undefined;
  const durPresent = durVal !== null && durVal !== undefined;

  const isDurationCol = durCol.uidt === UITypes.Duration;

  const toDays = (d: any): number | null => {
    if (d === null || d === undefined) return null;
    const n = Number(d);
    if (isNaN(n)) return null;
    return isDurationCol ? Math.round(n / 86400) : n;
  };

  const fromDays = (days: number): number => {
    return isDurationCol ? days * 86400 : days;
  };

  const toDate = (v: any): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  if (startPresent && endPresent && !inData(durCol)) {
    const s = toDate(startVal);
    const e = toDate(endVal);
    if (s && e && e >= s) {
      data[durCol.column_name] = fromDays(
        daysBetween(s, e, rule.include_weekends) + 1,
      );
    }
  } else if (startPresent && durPresent && !inData(endCol)) {
    const s = toDate(startVal);
    const days = toDays(durVal);
    if (s && days !== null && days >= 1) {
      data[endCol.column_name] = addDays(s, days - 1, rule.include_weekends)
        .toISOString()
        .split('T')[0];
    }
  } else if (endPresent && durPresent && !inData(startCol)) {
    const e = toDate(endVal);
    const days = toDays(durVal);
    if (e && days !== null && days >= 1) {
      data[startCol.column_name] = subtractDays(
        e,
        days - 1,
        rule.include_weekends,
      )
        .toISOString()
        .split('T')[0];
    }
  } else if (startPresent && endPresent && inData(durCol)) {
    // All three touched — recalculate duration from start+end (most explicit)
    const s = toDate(startVal);
    const e = toDate(endVal);
    if (s && e && e >= s) {
      data[durCol.column_name] = fromDays(
        daysBetween(s, e, rule.include_weekends) + 1,
      );
    }
  } else if (startPresent && durPresent && inData(endCol)) {
    const s = toDate(startVal);
    const days = toDays(durVal);
    if (s && days !== null && days >= 1) {
      data[endCol.column_name] = addDays(s, days - 1, rule.include_weekends)
        .toISOString()
        .split('T')[0];
    }
  }
}
