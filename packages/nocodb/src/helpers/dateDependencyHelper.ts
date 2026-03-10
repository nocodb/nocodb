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
  /** When false, all date arithmetic skips weekends (Sat/Sun). Default true. */
  includeWeekends?: boolean;
  /**
   * Propagation direction.
   * - `forward` (default): walk successors (children) and push their dates forward
   * - `backward`: walk predecessors (parents) and push their dates backward
   */
  direction?: 'forward' | 'backward';
}

// ─── Business-day SQL helpers ─────────────────────────────────────────────
//
// Pure-formula approach (no generate_series / subqueries) so they work inside
// the recursive member of a CTE on both PostgreSQL and MySQL 8+.
//
// PG uses ISODOW (1=Mon … 7=Sun).
// MySQL uses WEEKDAY (0=Mon … 6=Sun).

/**
 * Add `n` business days (Mon–Fri) to a date expression.
 *
 * Truth-table validated for all 25 (dow, n%5) weekday combinations:
 *   remainder r = n%5 (0–4), weekday dow (1–5 for PG ISODOW, 0–4 for MySQL WEEKDAY).
 *   When dow+r crosses the weekend boundary (>5 in PG, >4 in MySQL), we add 2
 *   calendar days to skip both Sat and Sun. This is correct for both one-weekend-day
 *   crossing (dow+r=6 → lands on Sat → +2 = Mon) and two-day crossing
 *   (dow+r=7 → lands on Sun → +2 = Tue, which is correct because r already accounts
 *   for the business days before the weekend).
 */
function addBizDaysSql(dateExpr: string, nExpr: string, isPg: boolean): string {
  if (isPg) {
    // ISODOW: 1=Mon..5=Fri, 6=Sat, 7=Sun
    // Explicit ::int casts ensure integer division even if nExpr resolves to numeric
    const dw = `EXTRACT(ISODOW FROM (${dateExpr})::date)::int`;
    const n = `(${nExpr})::int`;
    return `(CASE WHEN ${dw} >= 6 THEN
      (${dateExpr})::date + (8 - ${dw}) + (${n} / 5) * 7 + (${n} % 5)
    ELSE
      (${dateExpr})::date + (${n} / 5) * 7 + (${n} % 5)
      + CASE WHEN ${dw} + (${n} % 5) > 5 THEN 2 ELSE 0 END
    END)::date`;
  }
  // MySQL WEEKDAY: 0=Mon..4=Fri, 5=Sat, 6=Sun
  // MySQL DIV/MOD are always integer operations — no cast needed
  const dw = `WEEKDAY(${dateExpr})`;
  return `CAST(CASE WHEN ${dw} >= 5 THEN
    DATE_ADD(DATE_ADD(${dateExpr}, INTERVAL (7 - ${dw}) DAY),
             INTERVAL ((${nExpr}) DIV 5) * 7 + ((${nExpr}) MOD 5) DAY)
  ELSE
    DATE_ADD(${dateExpr}, INTERVAL ((${nExpr}) DIV 5) * 7 + ((${nExpr}) MOD 5)
      + CASE WHEN ${dw} + ((${nExpr}) MOD 5) > 4 THEN 2 ELSE 0 END DAY)
  END AS DATE)`;
}

/** Subtract `n` business days from a date expression. */
function subBizDaysSql(dateExpr: string, nExpr: string, isPg: boolean): string {
  if (isPg) {
    const dw = `EXTRACT(ISODOW FROM (${dateExpr})::date)::int`;
    const n = `(${nExpr})::int`;
    return `(CASE WHEN ${dw} >= 6 THEN
      (${dateExpr})::date - (${dw} - 5) - (${n} / 5) * 7 - (${n} % 5)
    ELSE
      (${dateExpr})::date - (${n} / 5) * 7 - (${n} % 5)
      - CASE WHEN ${dw} - (${n} % 5) < 1 THEN 2 ELSE 0 END
    END)::date`;
  }
  const dw = `WEEKDAY(${dateExpr})`;
  return `CAST(CASE WHEN ${dw} >= 5 THEN
    DATE_SUB(DATE_SUB(${dateExpr}, INTERVAL (${dw} - 4) DAY),
             INTERVAL ((${nExpr}) DIV 5) * 7 + ((${nExpr}) MOD 5) DAY)
  ELSE
    DATE_SUB(${dateExpr}, INTERVAL ((${nExpr}) DIV 5) * 7 + ((${nExpr}) MOD 5)
      + CASE WHEN ${dw} - ((${nExpr}) MOD 5) < 0 THEN 2 ELSE 0 END DAY)
  END AS DATE)`;
}

/**
 * Count the business-day "distance" from d1 to d2 such that
 * `addBizDays(d1, result) == d2`.  Assumes d2 >= d1 and both are weekdays.
 *
 * Uses the double-floor subtraction method which counts Saturdays and Sundays
 * in the span and subtracts them from the calendar diff. This is mathematically
 * equivalent to the modular-offset approach in addBizDaysSql — both have been
 * truth-table validated to be exact inverses for all weekday (dow, diff)
 * combinations. The ::int cast on the PG result ensures addBizDaysSql receives
 * an integer operand for its / and % operators.
 */
function bizDaysBetweenSql(d1: string, d2: string, isPg: boolean): string {
  if (isPg) {
    const diff = `((${d2})::date - (${d1})::date)`;
    const dw = `EXTRACT(ISODOW FROM (${d1})::date)::int`;
    return `(${diff} - FLOOR((${diff} + ${dw} - 1)::numeric / 7) - FLOOR((${diff} + ${dw})::numeric / 7))::int`;
  }
  const diff = `DATEDIFF(${d2}, ${d1})`;
  const dw = `WEEKDAY(${d1})`;
  return `CAST(${diff} - FLOOR((${diff} + ${dw}) / 7) - FLOOR((${diff} + ${dw} + 1) / 7) AS SIGNED)`;
}

/**
 * Builds a recursive CTE (SELECT only) that:
 *  1. Recursively traverses successor rows (cycle-safe, depth-limited)
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
    includeWeekends = true,
    direction = 'forward',
  } = params;

  // Guard: empty seedIds would produce `WHERE ... IN ()` — a syntax error
  if (!seedIds.length) {
    return { sql: 'SELECT NULL AS id WHERE 1 = 0', bindings: [] };
  }

  const isPg = dialect === 'pg';
  const skipWeekends = !includeWeekends;
  const isBackward = direction === 'backward';

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

  // ── Unified integer-based date arithmetic ───────────────────────────────
  //
  // When includeWeekends is true:  calendar-day arithmetic (date ± int).
  // When includeWeekends is false: business-day arithmetic via formula helpers.

  // Duration: integer count of days (calendar or business) between the row's
  // EXISTING start and end dates (t.start_col, t.end_col — the old values).
  // This is intentional: we preserve the task's original duration and shift the
  // window, keeping the length constant. For flexible bufferType, when the CASE
  // falls through to the original t.start_col, newEnd = old_start + old_dur =
  // old_end, which correctly means "no change" for rows that don't need shifting.
  const dur = skipWeekends
    ? bizDaysBetweenSql(`t.${sc}`, `t.${ec}`, isPg)
    : isPg
    ? `(t.${ec}::date - t.${sc}::date)`
    : `DATEDIFF(t.${ec}, t.${sc})`;

  // Add N days (calendar or business) to a date → date
  const addN = (base: string, n: string): string =>
    skipWeekends
      ? addBizDaysSql(base, n, isPg)
      : castDate(
          isPg
            ? `(${base})::date + (${n})`
            : `DATE_ADD(${base}, INTERVAL (${n}) DAY)`,
        );

  // Subtract N days (calendar or business) from a date → date
  const subN = (base: string, n: string): string =>
    skipWeekends
      ? subBizDaysSql(base, n, isPg)
      : castDate(
          isPg
            ? `(${base})::date - (${n})`
            : `DATE_SUB(${base}, INTERVAL (${n}) DAY)`,
        );

  // Build date computation expressions
  //
  // Forward: p = predecessor (CTE row), t = successor (table row being adjusted)
  //   → push t's dates forward when they overlap with p
  //
  // Backward: p = successor (CTE row), t = predecessor (table row being adjusted)
  //   → push t's dates backward when they overlap with p
  let newStartExpr: string;
  let newEndExpr: string;

  if (isBackward) {
    // ── Backward: push predecessor (t) dates earlier ──────────────────────
    // p = the successor/child (CTE row with already-computed dates)
    // t = the predecessor/parent (table row being adjusted)
    switch (connectionType) {
      case 'end-to-start': {
        // Constraint: predecessor.end + buffer + 1 <= successor.start
        // Violation: t.end >= p.start_date - buffer
        // Fix: t.end = p.start_date - buffer - 1
        const required = subN('p.start_date', String(bufferDays + 1));
        newEndExpr =
          bufferType === 'fixed'
            ? required
            : `CASE WHEN t.${ec} >= ${subN(
                'p.start_date',
                String(bufferDays),
              )} THEN ${required} ELSE t.${ec} END`;
        newStartExpr = subN(`(${newEndExpr})`, dur);
        break;
      }
      case 'end-to-end': {
        // Constraint: predecessor.end + buffer <= successor.end
        // Violation: t.end > p.end_date - buffer
        // Fix: t.end = p.end_date - buffer
        const required = subN('p.end_date', String(bufferDays));
        newEndExpr =
          bufferType === 'fixed'
            ? required
            : `CASE WHEN t.${ec} > ${subN(
                'p.end_date',
                String(bufferDays),
              )} THEN ${required} ELSE t.${ec} END`;
        newStartExpr = subN(`(${newEndExpr})`, dur);
        break;
      }
      case 'start-to-start': {
        // Constraint: predecessor.start + buffer <= successor.start
        // Violation: t.start > p.start_date - buffer
        // Fix: t.start = p.start_date - buffer
        const required = subN('p.start_date', String(bufferDays));
        newStartExpr =
          bufferType === 'fixed'
            ? required
            : `CASE WHEN t.${sc} > ${subN(
                'p.start_date',
                String(bufferDays),
              )} THEN ${required} ELSE t.${sc} END`;
        newEndExpr = addN(`(${newStartExpr})`, dur);
        break;
      }
      case 'start-to-end': {
        // Constraint: predecessor.start + buffer <= successor.end
        // Violation: t.start > p.end_date - buffer
        // Fix: t.start = p.end_date - buffer
        const required = subN('p.end_date', String(bufferDays));
        newStartExpr =
          bufferType === 'fixed'
            ? required
            : `CASE WHEN t.${sc} > ${subN(
                'p.end_date',
                String(bufferDays),
              )} THEN ${required} ELSE t.${sc} END`;
        newEndExpr = addN(`(${newStartExpr})`, dur);
        break;
      }
    }
  } else {
    // ── Forward: push successor (t) dates later ───────────────────────────
    switch (connectionType) {
      case 'end-to-start': {
        const required = addN('p.end_date', String(bufferDays + 1));
        newStartExpr =
          bufferType === 'fixed'
            ? required
            : `CASE WHEN t.${sc} <= ${addN(
                'p.end_date',
                String(bufferDays),
              )} THEN ${required} ELSE t.${sc} END`;
        newEndExpr = addN(`(${newStartExpr})`, dur);
        break;
      }
      case 'end-to-end': {
        const required = addN('p.end_date', String(bufferDays));
        newEndExpr =
          bufferType === 'fixed'
            ? required
            : `CASE WHEN t.${ec} < ${addN(
                'p.end_date',
                String(bufferDays),
              )} THEN ${required} ELSE t.${ec} END`;
        newStartExpr = subN(`(${newEndExpr})`, dur);
        break;
      }
      case 'start-to-start': {
        const required = addN('p.start_date', String(bufferDays));
        newStartExpr =
          bufferType === 'fixed'
            ? required
            : `CASE WHEN t.${sc} < ${addN(
                'p.start_date',
                String(bufferDays),
              )} THEN ${required} ELSE t.${sc} END`;
        newEndExpr = addN(`(${newStartExpr})`, dur);
        break;
      }
      case 'start-to-end': {
        const required = addN('p.start_date', String(bufferDays));
        newEndExpr =
          bufferType === 'fixed'
            ? required
            : `CASE WHEN t.${ec} < ${addN(
                'p.start_date',
                String(bufferDays),
              )} THEN ${required} ELSE t.${ec} END`;
        newStartExpr = subN(`(${newEndExpr})`, dur);
        break;
      }
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

  // Backward propagation needs FK value in CTE to walk up the parent chain
  const anchorFkVal = isBackward ? `,\n    ${castText(`t.${fk}`)}` : '';
  const recursiveFkVal = isBackward ? `,\n    ${castText(`t.${fk}`)}` : '';

  // Join direction:
  //   Forward:  t.fk = p.pk   (find children of CTE row)
  //   Backward: t.pk = p.fk_val (find parent of CTE row)
  const recursiveJoin = isBackward
    ? `${castText(`t.${pk}`)} = p.fk_val`
    : `${castText(`t.${fk}`)} = p.pk`;

  // CTE column list
  const cteColumns = isBackward
    ? 'pk, fk_val, start_date, end_date, level, path'
    : 'pk, start_date, end_date, level, path';

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
WITH RECURSIVE propagated(${cteColumns}) AS (
  SELECT
    ${castText(`t.${pk}`)}${anchorFkVal},
    t.${sc},
    t.${ec},
    0,
    ${anchorPath}
  FROM ${quotedTn} t
  WHERE ${castText(`t.${pk}`)} IN (${idPlaceholders})

  UNION ALL

  SELECT
    ${castText(`t.${pk}`)}${recursiveFkVal},
    ${castDate(newStartExpr)},
    ${castDate(newEndExpr)},
    p.level + 1,
    ${recursivePath}
  FROM ${quotedTn} t
  JOIN propagated p ON ${recursiveJoin}
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

/** Normalize a Date to UTC midnight to avoid DST-induced day shifts. */
function toUTCMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function daysBetween(start: Date, end: Date, includeWeekends = true): number {
  const s = toUTCMidnight(start);
  const e = toUTCMidnight(end);

  if (includeWeekends) {
    return Math.round((e.getTime() - s.getTime()) / 86400_000);
  }

  let count = 0;
  const cur = new Date(s);
  while (cur < e) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function addDays(date: Date, days: number, includeWeekends = true): Date {
  const result = toUTCMidnight(date);

  if (includeWeekends) {
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function subtractDays(date: Date, days: number, includeWeekends = true): Date {
  const result = toUTCMidnight(date);

  if (includeWeekends) {
    result.setUTCDate(result.getUTCDate() - days);
    return result;
  }

  let subtracted = 0;
  while (subtracted < days) {
    result.setUTCDate(result.getUTCDate() - 1);
    const day = result.getUTCDay();
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

  // data uses column_name keys; oldData uses title keys (prepareNocoData contract).
  // Defensive: try both column_name and title on both sources, since title ≠ column_name
  // is common with user-renamed columns and the key convention may not always hold.
  const resolve = (col: Column): any => {
    if (col.column_name in data) return data[col.column_name];
    if (col.title in data) return data[col.title];
    if (oldData) {
      if (col.title in oldData) return oldData[col.title];
      if (col.column_name in oldData) return oldData[col.column_name];
    }
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
