import { UITypes } from 'nocodb-sdk';
import type { DateDependencyType } from 'nocodb-sdk';
import type { Column } from '~/models';

// ─── Cross-record propagation SQL ──────────────────────────────────────────

export interface DateDependencyPropagationParams {
  tn: string;
  pkColName: string;
  /** Additional PK column names for composite PKs (carried through for output) */
  extraPkColNames?: string[];
  fkColName: string;
  startColName: string;
  endColName: string;
  connectionType:
    | 'end-to-start'
    | 'end-to-end'
    | 'start-to-start'
    | 'start-to-end';
  bufferType: 'flexible' | 'fixed';
  bufferDays: number;
  seedIds: string[];
  dialect: 'pg' | 'mysql';
}

/**
 * Builds a recursive CTE (SELECT only) that:
 *  1. Recursively traverses successor rows (cycle-safe)
 *  2. Computes new start/end dates at each level from the predecessor's
 *     already-computed dates — no application-level loops needed
 *  3. Returns { id, new_start, new_end } for every row that actually changed
 *
 * Supports PostgreSQL (ARRAY path) and MySQL 8+ (string path with FIND_IN_SET).
 */
export function buildDateDependencyPropagationSQL(
  params: DateDependencyPropagationParams,
): { sql: string; bindings: string[] } {
  const {
    tn,
    pkColName,
    extraPkColNames = [],
    fkColName,
    startColName,
    endColName,
    connectionType,
    bufferType,
    bufferDays,
    seedIds,
    dialect,
  } = params;

  const isPg = dialect === 'pg';

  // Quote table/column names per dialect
  const qChar = isPg ? '"' : '`';
  const esc = (s: string) =>
    `${qChar}${s.replace(new RegExp(qChar, 'g'), qChar + qChar)}${qChar}`;
  const quotedTn = tn
    .split('.')
    .map((p) => esc(p))
    .join('.');

  const pk = esc(pkColName);
  const fk = esc(fkColName);
  const sc = esc(startColName);
  const ec = esc(endColName);

  // Seed placeholders for knex positional bindings
  const idPlaceholders = seedIds.map(() => '?').join(', ');

  // Dialect-specific helpers
  const castText = (expr: string) =>
    isPg ? `${expr}::text` : `CAST(${expr} AS CHAR)`;
  const castDate = (expr: string) =>
    isPg ? `(${expr})::date` : `CAST(${expr} AS DATE)`;
  const intervalDays = (n: number | string) =>
    isPg ? `(${n} * INTERVAL '1 day')` : `INTERVAL ${n} DAY`;

  const buf = intervalDays(bufferDays);
  const oneDay = isPg ? `INTERVAL '1 day'` : `INTERVAL 1 DAY`;

  // Duration expression: old_end - old_start as an interval
  // PG: (date - date) returns int → multiply by interval
  // MySQL: DATEDIFF returns int → use DATE_ADD later
  const dur = isPg
    ? `(t.${ec}::date - t.${sc}::date) * INTERVAL '1 day'`
    : `DATEDIFF(t.${ec}, t.${sc})`;

  // Date arithmetic helpers
  const dateAdd = (base: string, interval: string) =>
    isPg
      ? `${base} + ${interval}`
      : `DATE_ADD(${base}, INTERVAL ${interval} DAY)`;
  const dateSub = (base: string, interval: string) =>
    isPg
      ? `${base} - ${interval}`
      : `DATE_SUB(${base}, INTERVAL ${interval} DAY)`;

  // Build date computation expressions
  let newStartExpr: string;
  let newEndExpr: string;

  switch (connectionType) {
    case 'end-to-start': {
      const required = dateAdd(
        `p.end_date`,
        isPg ? `${buf} + ${oneDay}` : `${bufferDays} + 1`,
      );
      newStartExpr =
        bufferType === 'fixed'
          ? required
          : `CASE WHEN t.${sc} <= ${dateAdd(
              'p.end_date',
              isPg ? buf : String(bufferDays),
            )} THEN ${required} ELSE t.${sc} END`;
      newEndExpr = dateAdd(`(${newStartExpr})`, isPg ? dur : dur);
      break;
    }
    case 'end-to-end': {
      const required = dateAdd(`p.end_date`, isPg ? buf : String(bufferDays));
      newEndExpr =
        bufferType === 'fixed'
          ? required
          : `CASE WHEN t.${ec} < ${dateAdd(
              'p.end_date',
              isPg ? buf : String(bufferDays),
            )} THEN ${required} ELSE t.${ec} END`;
      newStartExpr = dateSub(`(${newEndExpr})`, isPg ? dur : dur);
      break;
    }
    case 'start-to-start': {
      const required = dateAdd(`p.start_date`, isPg ? buf : String(bufferDays));
      newStartExpr =
        bufferType === 'fixed'
          ? required
          : `CASE WHEN t.${sc} < ${dateAdd(
              'p.start_date',
              isPg ? buf : String(bufferDays),
            )} THEN ${required} ELSE t.${sc} END`;
      newEndExpr = dateAdd(`(${newStartExpr})`, isPg ? dur : dur);
      break;
    }
    case 'start-to-end': {
      const required = dateAdd(`p.start_date`, isPg ? buf : String(bufferDays));
      newEndExpr =
        bufferType === 'fixed'
          ? required
          : `CASE WHEN t.${ec} < ${dateAdd(
              'p.start_date',
              isPg ? buf : String(bufferDays),
            )} THEN ${required} ELSE t.${ec} END`;
      newStartExpr = dateSub(`(${newEndExpr})`, isPg ? dur : dur);
      break;
    }
  }

  // Cycle detection and path tracking differ by dialect
  // PG:    ARRAY[pk] / path || pk / NOT (pk = ANY(path))
  // MySQL: CAST(pk AS CHAR) / CONCAT(path, ',', pk) / NOT FIND_IN_SET(pk, path)
  const anchorPath = isPg
    ? `ARRAY[${castText(`t.${pk}`)}]`
    : castText(`t.${pk}`);
  const recursivePath = isPg
    ? `p.path || ${castText(`t.${pk}`)}`
    : `CONCAT(p.path, ',', ${castText(`t.${pk}`)})`;
  const cycleCheck = isPg
    ? `NOT (${castText(`t.${pk}`)} = ANY(p.path))`
    : `NOT FIND_IN_SET(${castText(`t.${pk}`)}, p.path)`;

  // Extra PK columns for composite PKs — selected from the joined table `t`
  const extraPkSelect = extraPkColNames
    .map((col, i) => `t.${esc(col)} AS id_${i + 1}`)
    .join(', ');
  const extraPkSelectPrefix = extraPkSelect ? `,\n    ${extraPkSelect}` : '';
  const extraPkOuterCols = extraPkColNames
    .map((_, i) => `id_${i + 1}`)
    .join(', ');
  const extraPkOuterPrefix = extraPkOuterCols ? `, ${extraPkOuterCols}` : '';

  // Deduplication: pick shortest path per row
  // PG:    DISTINCT ON (pk) ... ORDER BY pk, level
  // MySQL: ROW_NUMBER() window function
  const dedupQuery = isPg
    ? `SELECT DISTINCT ON (p.pk)
    p.pk         AS id${extraPkSelectPrefix},
    p.start_date AS new_start,
    p.end_date   AS new_end,
    t.${sc}      AS old_start,
    t.${ec}      AS old_end
  FROM propagated p
  JOIN ${quotedTn} t ON ${castText(`t.${pk}`)} = p.pk
  WHERE p.level > 0
  ORDER BY p.pk, p.level ASC`
    : `SELECT id${extraPkOuterPrefix}, new_start, new_end, old_start, old_end FROM (
    SELECT
      p.pk         AS id${extraPkSelectPrefix},
      p.start_date AS new_start,
      p.end_date   AS new_end,
      t.${sc}      AS old_start,
      t.${ec}      AS old_end,
      ROW_NUMBER() OVER (PARTITION BY p.pk ORDER BY p.level ASC) AS rn
    FROM propagated p
    JOIN ${quotedTn} t ON ${castText(`t.${pk}`)} = p.pk
    WHERE p.level > 0
  ) ranked WHERE rn = 1`;

  // Changed-row filter
  // PG:    IS DISTINCT FROM (null-safe inequality)
  // MySQL: NOT <=> (null-safe equality operator, negated)
  const changedFilter = isPg
    ? `old_start IS DISTINCT FROM new_start OR old_end IS DISTINCT FROM new_end`
    : `NOT (old_start <=> new_start) OR NOT (old_end <=> new_end)`;

  const sql = `
WITH RECURSIVE propagated(pk, start_date, end_date, level, path) AS (
  SELECT
    ${castText(`t.${pk}`)},
    t.${sc},
    t.${ec},
    0,
    ${anchorPath}
  FROM ${quotedTn} t
  WHERE ${castText(`t.${pk}`)} IN (${idPlaceholders})

  UNION ALL

  SELECT
    ${castText(`t.${pk}`)},
    ${castDate(newStartExpr)},
    ${castDate(newEndExpr)},
    p.level + 1,
    ${recursivePath}
  FROM ${quotedTn} t
  JOIN propagated p ON ${castText(`t.${fk}`)} = p.pk
  WHERE ${cycleCheck}
    AND t.${sc} IS NOT NULL
    AND t.${ec} IS NOT NULL
    AND p.start_date IS NOT NULL
    AND p.end_date IS NOT NULL
),
deduped AS (
  ${dedupQuery}
)
SELECT id${extraPkOuterPrefix}, new_start, new_end
FROM deduped
WHERE ${changedFilter}`.trim();

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
