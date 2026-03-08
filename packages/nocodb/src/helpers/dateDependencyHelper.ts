import { UITypes } from 'nocodb-sdk';
import type { DateDependencyType } from 'nocodb-sdk';
import type { Column } from '~/models';

// ─── Cross-record propagation SQL ──────────────────────────────────────────

export interface DateDependencyPropagationParams {
  tn: string;
  pkColName: string;
  fkColName: string;
  startColName: string;
  endColName: string;
  connectionType:
    | 'end-to-start'
    | 'end-to-end'
    | 'start-to-start'
    | 'start-to-finish';
  bufferType: 'flexible' | 'fixed';
  bufferDays: number;
  seedIds: string[];
}

/**
 * Builds a single PostgreSQL CTE that:
 *  1. Recursively traverses successor rows (cycle-safe via path array)
 *  2. Computes new start/end dates at each level from the predecessor's
 *     already-computed dates — no application-level loops needed
 *  3. Issues one UPDATE and returns { id, old_start, old_end, new_start,
 *     new_end } for every row actually changed — used for audit + sockets
 *
 * PostgreSQL-only (ARRAY path tracking + RETURNING).
 */
export function buildDateDependencyPropagationSQL(
  params: DateDependencyPropagationParams,
): { sql: string; bindings: any[] } {
  const {
    tn,
    pkColName,
    fkColName,
    startColName,
    endColName,
    connectionType,
    bufferType,
    bufferDays,
    seedIds,
  } = params;

  // Quote table name — handle optional schema prefix (schema.table)
  const quotedTn = tn
    .split('.')
    .map((p) => `"${p.replace(/"/g, '""')}"`)
    .join('.');

  // Quote individual column names
  const q = (col: string) => `"${col.replace(/"/g, '""')}"`;
  const pk = q(pkColName);
  const fk = q(fkColName);
  const sc = q(startColName);
  const ec = q(endColName);

  // Seed placeholders for knex positional bindings
  const idPlaceholders = seedIds.map(() => '?').join(', ');

  // Buffer interval expression (bufferDays is an integer from the config)
  const buf = `(${bufferDays} * INTERVAL '1 day')`;

  // Build date computation expressions.
  // p.start_date / p.end_date = predecessor's computed dates from the CTE.
  // t.sc / t.ec = successor's CURRENT values from the DB (pre-update).
  // Duration is always preserved: new_end = new_start + (old_end - old_start).
  //
  // NocoDB Date columns may be stored as PostgreSQL `date` type, in which case
  // `date - date` returns an integer (days), not an interval.  Adding an integer
  // to a timestamp fails, so we always convert the duration to an interval:
  //   (t.ec::date - t.sc::date) * INTERVAL '1 day'
  // This is safe for both `date` and `timestamp` column storage.
  const dur = `(t.${ec}::date - t.${sc}::date) * INTERVAL '1 day'`;

  let newStartExpr: string;
  let newEndExpr: string;

  switch (connectionType) {
    case 'end-to-start': {
      // FS: pred.end drives succ.start
      const required = `p.end_date + ${buf} + INTERVAL '1 day'`;
      newStartExpr =
        bufferType === 'fixed'
          ? required
          : `CASE WHEN t.${sc} <= p.end_date + ${buf} THEN ${required} ELSE t.${sc} END`;
      newEndExpr = `(${newStartExpr}) + ${dur}`;
      break;
    }
    case 'end-to-end': {
      // FF: pred.end drives succ.end
      const required = `p.end_date + ${buf}`;
      newEndExpr =
        bufferType === 'fixed'
          ? required
          : `CASE WHEN t.${ec} < p.end_date + ${buf} THEN ${required} ELSE t.${ec} END`;
      newStartExpr = `(${newEndExpr}) - ${dur}`;
      break;
    }
    case 'start-to-start': {
      // SS: pred.start drives succ.start
      const required = `p.start_date + ${buf}`;
      newStartExpr =
        bufferType === 'fixed'
          ? required
          : `CASE WHEN t.${sc} < p.start_date + ${buf} THEN ${required} ELSE t.${sc} END`;
      newEndExpr = `(${newStartExpr}) + ${dur}`;
      break;
    }
    case 'start-to-finish': {
      // SF: pred.start drives succ.end
      const required = `p.start_date + ${buf}`;
      newEndExpr =
        bufferType === 'fixed'
          ? required
          : `CASE WHEN t.${ec} < p.start_date + ${buf} THEN ${required} ELSE t.${ec} END`;
      newStartExpr = `(${newEndExpr}) - ${dur}`;
      break;
    }
  }

  const sql = `
WITH RECURSIVE propagated(pk, start_date, end_date, level, path) AS (
  -- Anchor: seed rows carry their current dates as the starting point
  SELECT
    t.${pk}::text,
    t.${sc},
    t.${ec},
    0,
    ARRAY[t.${pk}::text]
  FROM ${quotedTn} t
  WHERE t.${pk}::text IN (${idPlaceholders})

  UNION ALL

  -- Recursive: compute successor dates from predecessor's computed dates
  SELECT
    t.${pk}::text,
    (${newStartExpr})::date,
    (${newEndExpr})::date,
    p.level + 1,
    p.path || t.${pk}::text
  FROM ${quotedTn} t
  JOIN propagated p ON t.${fk}::text = p.pk
  WHERE NOT (t.${pk}::text = ANY(p.path))   -- cycle prevention
    AND t.${sc} IS NOT NULL
    AND t.${ec} IS NOT NULL
    AND p.start_date IS NOT NULL
    AND p.end_date IS NOT NULL
),
deduped AS (
  -- Per row: pick shortest path (most direct predecessor wins)
  -- Also capture old values here — before the UPDATE runs
  SELECT DISTINCT ON (p.pk)
    p.pk         AS id,
    p.start_date AS new_start,
    p.end_date   AS new_end,
    t.${sc}      AS old_start,
    t.${ec}      AS old_end
  FROM propagated p
  JOIN ${quotedTn} t ON t.${pk}::text = p.pk
  WHERE p.level > 0
  ORDER BY p.pk, p.level ASC
)
UPDATE ${quotedTn} t
SET
  ${sc} = d.new_start,
  ${ec} = d.new_end
FROM deduped d
WHERE t.${pk}::text = d.id
  AND (
    t.${sc} IS DISTINCT FROM d.new_start
    OR t.${ec} IS DISTINCT FROM d.new_end
  )
RETURNING
  t.${pk}   AS id,
  d.old_start,
  d.old_end,
  d.new_start,
  d.new_end`.trim();

  return { sql, bindings: [...seedIds] };
}

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
  rule: DateDependencyType,
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
