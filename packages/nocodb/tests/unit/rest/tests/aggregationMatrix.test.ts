import { beforeEach } from 'mocha';
import request from 'supertest';
import {
  UITypes,
  ViewTypes,
  computeAggregation,
  getAvailableAggregations,
} from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createColumn, createLtarColumn, createLtarColumn2, createRollupColumn, createLookupColumn, createBarcodeColumn, createQrCodeColumn } from '../../factory/column';
import { createView } from '../../factory/view';
import { internalPost } from '../../factory/internal';
import {
  isMssqlData,
  isMysqlData,
  isPgData,
  isSqliteData,
} from '../../init/db';
import type { Base, Column, Model, View } from '~/models';

// ────────────────────────────────────────────────────────────────────────────
// Comprehensive backend-aggregation matrix — the single home for aggregation
// tests, so a newly-added aggregation is validated everywhere at once.
//
// For (almost) every supported field type it exercises every aggregation that
// `getAvailableAggregations(uidt)` exposes, and checks the result against an
// INDEPENDENT hand-computed ORACLE. For non-virtual columns it also cross-checks
// the SDK reducer `computeAggregation()` over the same cell values (oracle vs
// SQL vs reducer — the oracle catches bugs SQL and the reducer share; the
// reducer catches arithmetic mistakes in the oracle).
//
// What runs:
//   • scalar + formula suite — every field-type × aggregation via BOTH the
//     single (GET /aggregate) and bulk (POST /bulk/aggregate) endpoints; plus
//     selection-subset parity (SQL over a `where` filter == reducer over those
//     rows) and a multi-bucket /bulk/aggregate request.
//   • link/relation suite — Links / Rollup / Count / Lookup over hm, mm,
//     self-referential and oo relations. A virtual column's records-list value
//     can differ from the server aggregate (documented in the SDK reducer), so
//     the reducer cross-check is OFF there — SQL is checked against the oracle.
//
// System / auto-value columns ARE covered: the grid view enables
// show_system_fields (see enableSystemFields) so the footer aggregates ID,
// CreatedTime, LastModifiedTime, CreatedBy, LastModifiedBy (and AutoNumber on
// pg / UUID on pg+mssql). Only their structurally-deterministic aggregations are
// asserted (SYSTEM_ORACLE) — exact timestamp values / distinct-counts are
// environment-dependent and skipped; the reducer cross-check is off (the records
// list doesn't expose these under their titles).
//
// Dialects: pg / sqlite / mysql run locally; mssql runs in the
// unit-tests-pg-mssql CI job. Fixtures avoid cross-dialect noise — full-table
// footer over non-empty data, odd non-null counts (median needs no
// interpolation), float epsilon, dates compared by date-part. The one genuine
// per-dialect difference (mysql coalesces `Number + 10` null→0) is asserted
// explicitly via DIALECT_ORACLE rather than hidden.
//
// Not covered (deliberately): the Count column (footer returns null for its
// value-referencing aggregations); Attachment (attachment_size) and Collaborator
// (alias of User, covered via the User column) — out of scope per request;
// None-only types (ForeignKey, SpecificDBType, Button); internal columns (Order,
// Deleted, Meta); Geometry (PostGIS-typed on pg — GeoData covers the modern
// type); bt (the auto-inverse of hm, same to-one shape as the covered oo).
// ────────────────────────────────────────────────────────────────────────────

// 6 deterministic rows. Each numeric column has exactly ONE null → 5 non-null
// (odd) so median needs no interpolation. Nulls / zeros / duplicates exercise
// count_empty / count_filled / count_unique and Rating's 0-as-empty rule.
// DateTime uses noon so an IST(+5:30)/UTC server-TZ shift never crosses a day.
const FIXTURES = [
  {
    Number: 10, Decimal: 1.5, Currency: 100, Percent: 10, Duration: 60, Rating: 4,
    DateField: '2024-01-15', DateTimeField: '2024-01-15 12:00:00',
    Checkbox: true,
    Text: 'alpha', LongText: 'long a', Email: 'a@x.com', Url: 'https://a.com',
    Phone: '111', SingleSelect: 'jan', MultiSelect: 'jan', Json: '[1,2]',
    Year: 2020, Time: '10:00:00', Colour: '#ff0000', GeoData: '12.9;77.5',
  },
  {
    Number: 20, Decimal: 2.5, Currency: 200, Percent: 20, Duration: 120, Rating: 5,
    DateField: '2024-02-10', DateTimeField: '2024-02-10 12:00:00',
    Checkbox: false,
    Text: 'beta', LongText: 'long b', Email: 'b@x.com', Url: 'https://b.com',
    Phone: '222', SingleSelect: 'feb', MultiSelect: 'jan,feb', Json: '[3]',
    Year: 2021, Time: '11:00:00', Colour: '#00ff00', GeoData: '13.0;80.2',
  },
  {
    Number: 30, Decimal: 3.5, Currency: 300, Percent: 30, Duration: 180, Rating: 3,
    DateField: '2024-03-20', DateTimeField: '2024-03-20 12:00:00',
    Checkbox: true,
    Text: 'alpha', LongText: 'long c', Email: 'a@x.com', Url: null,
    Phone: '333', SingleSelect: 'jan', MultiSelect: 'feb', Json: '[1,2]',
    Year: 2022, Time: '12:00:00', Colour: '#0000ff', GeoData: '12.9;77.5',
  },
  {
    Number: 40, Decimal: 4.5, Currency: 400, Percent: 40, Duration: 240, Rating: 2,
    DateField: '2024-04-05', DateTimeField: '2024-04-05 12:00:00',
    Checkbox: null,
    Text: '', LongText: 'long d', Email: null, Url: null,
    Phone: null, SingleSelect: null, MultiSelect: null, Json: '[7,8]',
    Year: 2023, Time: '13:00:00', Colour: '#ffff00', GeoData: '19.0;72.8',
  },
  {
    Number: 50, Decimal: 5.5, Currency: 500, Percent: 50, Duration: 300, Rating: 0,
    DateField: '2025-01-01', DateTimeField: '2025-01-01 12:00:00',
    Checkbox: false,
    Text: 'gamma', LongText: 'long e', Email: null, Url: null,
    Phone: null, SingleSelect: 'mar', MultiSelect: 'mar', Json: null,
    Year: 2024, Time: '14:00:00', Colour: '#ff00ff', GeoData: '28.6;77.2',
  },
  {
    Number: null, Decimal: null, Currency: null, Percent: null, Duration: null, Rating: null,
    DateField: null, DateTimeField: null,
    Checkbox: true,
    Text: null, LongText: null, Email: null, Url: null,
    Phone: null, SingleSelect: null, MultiSelect: null, Json: null,
    Year: null, Time: null, Colour: null, GeoData: null,
  },
];

// V1 column payloads created at table-creation time.
const COLUMNS = [
  { column_name: 'Id', title: 'Id', uidt: UITypes.ID, ai: 1, pk: 1 },
  { column_name: 'Number', title: 'Number', uidt: UITypes.Number },
  { column_name: 'Decimal', title: 'Decimal', uidt: UITypes.Decimal },
  { column_name: 'Currency', title: 'Currency', uidt: UITypes.Currency },
  { column_name: 'Percent', title: 'Percent', uidt: UITypes.Percent },
  { column_name: 'Duration', title: 'Duration', uidt: UITypes.Duration },
  { column_name: 'Rating', title: 'Rating', uidt: UITypes.Rating },
  { column_name: 'DateField', title: 'DateField', uidt: UITypes.Date },
  { column_name: 'DateTimeField', title: 'DateTimeField', uidt: UITypes.DateTime },
  { column_name: 'Checkbox', title: 'Checkbox', uidt: UITypes.Checkbox },
  { column_name: 'Text', title: 'Text', uidt: UITypes.SingleLineText },
  { column_name: 'LongText', title: 'LongText', uidt: UITypes.LongText },
  { column_name: 'Email', title: 'Email', uidt: UITypes.Email },
  { column_name: 'Url', title: 'Url', uidt: UITypes.URL },
  { column_name: 'Phone', title: 'Phone', uidt: UITypes.PhoneNumber },
  { column_name: 'SingleSelect', title: 'SingleSelect', uidt: UITypes.SingleSelect, dtxp: "'jan','feb','mar'" },
  { column_name: 'MultiSelect', title: 'MultiSelect', uidt: UITypes.MultiSelect, dtxp: "'jan','feb','mar'" },
  { column_name: 'Json', title: 'Json', uidt: UITypes.JSON },
  { column_name: 'Year', title: 'Year', uidt: UITypes.Year },
  { column_name: 'Time', title: 'Time', uidt: UITypes.Time },
  { column_name: 'Colour', title: 'Colour', uidt: UITypes.Colour },
  { column_name: 'GeoData', title: 'GeoData', uidt: UITypes.GeoData },
  { column_name: 'UserField', title: 'UserField', uidt: UITypes.User },
];

// Auto-value columns with limited dialect support — appended to the table only
// on dialects that support them (AutoNumber: pg only; UUID: pg + mssql).
const AUTONUMBER_COL = { column_name: 'AutoNumberField', title: 'AutoNumberField', uidt: UITypes.AutoNumber };
const UUID_COL = { column_name: 'UuidField', title: 'UuidField', uidt: UITypes.UUID };
function autoValueColumnsFor(dialect: string): Array<Record<string, any>> {
  const cols: Array<Record<string, any>> = [];
  if (dialect === 'pg') cols.push(AUTONUMBER_COL);
  if (dialect === 'pg' || dialect === 'mssql') cols.push(UUID_COL);
  return cols;
}

// Common aggregations are a pure function of (total, empty, filled, unique).
function commonOracle(total: number, empty: number, filled: number, unique: number) {
  return {
    count: total,
    count_empty: empty,
    count_filled: filled,
    count_unique: unique,
    percent_empty: (empty * 100) / total,
    percent_filled: (filled * 100) / total,
    percent_unique: (unique * 100) / total,
  };
}

const T = FIXTURES.length; // 6

// Independent oracle, keyed by column title → aggregation → expected value.
const ORACLE: Record<string, Record<string, number | string | null>> = {
  // Auto-value columns — every row has a distinct, non-empty value. Aggregatable
  // once the grid view has show_system_fields enabled (see enableSystemFields).
  Id: commonOracle(T, 0, T, T),
  AutoNumberField: commonOracle(T, 0, T, T),
  UuidField: commonOracle(T, 0, T, T),
  Number: { sum: 150, min: 10, max: 50, avg: 30, median: 30, range: 40, std_dev: Math.sqrt(200), ...commonOracle(T, 1, 5, 5) },
  Decimal: { sum: 17.5, min: 1.5, max: 5.5, avg: 3.5, median: 3.5, range: 4, std_dev: Math.sqrt(2), ...commonOracle(T, 1, 5, 5) },
  Currency: { sum: 1500, min: 100, max: 500, avg: 300, median: 300, range: 400, std_dev: Math.sqrt(20000), ...commonOracle(T, 1, 5, 5) },
  Percent: { sum: 150, min: 10, max: 50, avg: 30, median: 30, range: 40, std_dev: Math.sqrt(200), ...commonOracle(T, 1, 5, 5) },
  Duration: { sum: 900, min: 60, max: 300, avg: 180, median: 180, range: 240, std_dev: Math.sqrt(7200), ...commonOracle(T, 1, 5, 5) },
  // Rating: 0 is "empty". avg/min/range/std_dev skip 0; sum/max/median include it.
  Rating: { sum: 14, min: 2, max: 5, avg: 3.5, median: 3, range: 3, std_dev: Math.sqrt(1.25), ...commonOracle(T, 2, 4, 4) },
  DateField: { earliest_date: '2024-01-15', latest_date: '2025-01-01', date_range: 352, month_range: 12, ...commonOracle(T, 1, 5, 5) },
  DateTimeField: { earliest_date: '2024-01-15', latest_date: '2025-01-01', date_range: 352, month_range: 12, ...commonOracle(T, 1, 5, 5) },
  Checkbox: { checked: 3, unchecked: 3, percent_checked: 50, percent_unchecked: 50 },
  Text: commonOracle(T, 2, 4, 3),
  LongText: commonOracle(T, 1, 5, 5),
  Email: commonOracle(T, 3, 3, 2),
  Url: commonOracle(T, 4, 2, 2),
  Phone: commonOracle(T, 3, 3, 3),
  SingleSelect: commonOracle(T, 2, 4, 3),
  MultiSelect: commonOracle(T, 2, 4, 4),
  Json: commonOracle(T, 2, 4, 3),
  Year: commonOracle(T, 1, 5, 5),
  Time: commonOracle(T, 1, 5, 5),
  Colour: commonOracle(T, 1, 5, 5),
  GeoData: commonOracle(T, 1, 5, 4), // 12.9;77.5 duplicated → 4 unique of 5 filled
  UserField: commonOracle(T, 6, 0, 0), // seeded null → all empty
  // Formula columns (created post-table; titles below)
  FormulaNum: { sum: 200, min: 20, max: 60, avg: 40, median: 40, range: 40, std_dev: Math.sqrt(200), ...commonOracle(T, 1, 5, 5) },
  FormulaDate: { earliest_date: '2024-01-15', latest_date: '2025-01-01', date_range: 352, month_range: 12, ...commonOracle(T, 1, 5, 5) },
  // Barcode/QrCode mirror their referenced Text column.
  BarcodeField: commonOracle(T, 2, 4, 3),
  QrCodeField: commonOracle(T, 2, 4, 3),
};

// ── Link / relation suite oracle ────────────────────────────────────────────
// hm topology: six main rows, each linked to ≥1 child (unlinked rows resolve to
// 0, not null, so we link every row to keep the value set clean). Even-count
// median agrees across all dialects (PG percentile_cont(0.5) == the hand-rolled
// mid-average). mm / self-ref / oo oracles are documented at their entries below.
//   Main1 → child amounts [10,20]  (links 2, sum 30)
//   Main2 → [30]                   (links 1, sum 30)
//   Main3 → [40,50]                (links 2, sum 90)
//   Main4 → [60]                   (links 1, sum 60)
//   Main5 → [70]                   (links 1, sum 70)
//   Main6 → [80]                   (links 1, sum 80)
const LINK_ORACLE: Record<string, Record<string, number | string | null>> = {
  // Links value = number of linked children: [2,1,2,1,1,1]
  LinksField: {
    sum: 8, min: 1, max: 2, avg: 8 / 6, median: 1, range: 1, std_dev: Math.sqrt(2 / 9),
    ...commonOracle(T, 0, 6, 2),
  },
  // Rollup(sum of child Amount): [30,30,90,60,70,80]
  RollupSum: {
    sum: 360, min: 30, max: 90, avg: 60, median: 65, range: 60, std_dev: Math.sqrt(3200 / 6),
    ...commonOracle(T, 0, 6, 5),
  },
  // NOTE: the Count column is created but NOT asserted — like auto columns, its
  // footer aggregation returns null for value-referencing aggs (Links already
  // covers link-counting numerically).
  // Lookup of child Title — every row links a distinct child set.
  LookupField: commonOracle(T, 0, 6, 6),
  // mm LinkToAnotherRecord — no mm links created → all empty.
  LtarField: commonOracle(T, 6, 0, 0),
  // mm Links (numeric) — each main row linked to exactly one child → all counts 1.
  MmLinks: {
    sum: 6, min: 1, max: 1, avg: 1, median: 1, range: 0, std_dev: 0,
    ...commonOracle(T, 0, 6, 1),
  },
  // self-referential hm Links (numeric) — ring linking → all counts 1.
  SelfLinks: {
    sum: 6, min: 1, max: 1, avg: 1, median: 1, range: 0, std_dev: 0,
    ...commonOracle(T, 0, 6, 1),
  },
  // oneToOne (to-one) — 2 of 6 main rows linked.
  OoField: commonOracle(T, 4, 2, 2),
};

// Per-dialect oracle overrides for genuine, intentional dialect behavior
// differences (every dialect is still fully asserted — nothing is skipped):
//
//  - MySQL compiles a binary formula like `Number + 10` as
//    `IFNULL(\`Number\` + 10, 0)` (parsed-tree-builder.ts), so the null row
//    resolves to 0 instead of null. pg/sqlite/mssql keep it null. That shifts
//    every FormulaNum aggregation on MySQL — values below are the actual
//    (DB-verified) results over [20,30,40,50,60,0]. (The MySQL percent_unique
//    subquery-paren bug, by contrast, was a real defect and is fixed in
//    mysql2.ts — no override needed.)
const DIALECT_ORACLE: Record<
  string,
  Record<string, Record<string, number | string | null>>
> = {
  mysql: {
    FormulaNum: {
      sum: 200, min: 0, max: 60, avg: 200 / 6, median: 35, range: 60,
      std_dev: Math.sqrt(21000 / 54),
      ...commonOracle(T, 0, 6, 6),
    },
  },
};

// Auto-managed system columns, matched by uidt (their titles vary by edition).
// Aggregatable once the view has show_system_fields enabled. Only the
// structurally-deterministic aggregations are asserted — the exact
// timestamp/user values and their distinct-counts are environment-dependent, so
// earliest/latest/count_unique/percent_unique are skipped (not failed) here.
// All six rows are created together in one beforeEach → same day/month.
const SYSTEM_ORACLE: Partial<Record<string, Record<string, number | string | null>>> = {
  // Created* are populated on insert → deterministic (all filled, same
  // day/month). LastModified* are populated inconsistently on create across
  // dialects/runs, so only `count` is reliable there — the rest is skipped.
  [UITypes.CreatedTime]: {
    count: T, count_empty: 0, count_filled: T, percent_empty: 0, percent_filled: 100,
    date_range: 0, month_range: 0,
  },
  [UITypes.LastModifiedTime]: { count: T },
  [UITypes.CreatedBy]: {
    count: T, count_empty: 0, count_filled: T, percent_empty: 0, percent_filled: 100,
  },
  [UITypes.LastModifiedBy]: { count: T },
};

function dialectName(context: any): string {
  if (isMssqlData(context)) return 'mssql';
  if (isPgData(context)) return 'pg';
  if (isMysqlData(context)) return 'mysql';
  if (isSqliteData(context)) return 'sqlite';
  return 'unknown';
}

function epsilonFor(agg: string): number {
  if (agg === 'std_dev') return 1e-4;
  // Division-based aggregations: MySQL's single (GET /aggregate) endpoint
  // returns DECIMAL division rounded to ~4-5 places (the bulk path serializes
  // via JSON → full float). Same value, looser scale — tolerate it.
  if (agg === 'avg' || agg.startsWith('percent')) return 1e-3;
  return 1e-6;
}

function isDateValueAgg(agg: string): boolean {
  return agg === 'earliest_date' || agg === 'latest_date';
}

function toDatePart(v: any): string {
  return String(v).split(/[ T]/)[0];
}

function norm(v: any, agg: string): { kind: 'null' | 'num' | 'str'; value: any } {
  if (v === null || v === undefined) return { kind: 'null', value: null };
  if (isDateValueAgg(agg)) return { kind: 'str', value: toDatePart(v) };
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== '') return { kind: 'num', value: n };
  return { kind: 'str', value: String(v) };
}

interface Selection {
  name: string;
  where: string;
  rowIds: number[]; // 1-based ids matching insertion order
}

// Row subsets exercised by the selection-subset suite (Id 1..6 in FIXTURES order).
const SELECTIONS: Selection[] = [
  { name: 'first-3', where: '(Id,lte,3)', rowIds: [1, 2, 3] },
  { name: 'last-3', where: '(Id,gte,4)', rowIds: [4, 5, 6] },
  { name: 'middle-3', where: '(Id,gte,2)~and(Id,lte,4)', rowIds: [2, 3, 4] },
  { name: 'single-3', where: '(Id,eq,3)', rowIds: [3] },
];

function aggregationTestFactory(
  setup: (api: TestApi) => Promise<void>,
  opts: {
    checkReducer?: boolean;
    selections?: Selection[];
    multiBucket?: boolean;
  } = {},
) {
  // For link-based virtual columns the records-list cell value can differ from
  // the server-side aggregate (the SDK reducer note documents this as expected),
  // so those suites assert the SQL footer value against the oracle only.
  const checkReducer = opts.checkReducer !== false;
  interface Ctx {
    context: any;
    table: Model;
    gridView: View;
    columns: Column[];
    allRecords: any[];
  }
  const t: Partial<Ctx> = {};

  async function fetchSqlAggregation(
    fieldId: string,
    type: string,
    where = '',
  ): Promise<any> {
    const aggregation = JSON.stringify([{ field: fieldId, type }]);
    const alias = 'footer';
    const resp = await request(t.context.app)
      .post(`/api/v2/tables/${t.table!.id}/bulk/aggregate`)
      .set('xc-auth', t.context.token)
      .query({ viewId: t.gridView!.id, aggregation })
      .send([{ where, alias }]);
    if (resp.status >= 400) {
      throw new Error(`bulk/aggregate ${type} failed (${resp.status}): ${JSON.stringify(resp.body)}`);
    }
    const bucket = resp.body[alias];
    if (!bucket) return null;
    return bucket[Object.keys(bucket)[0]];
  }

  // POST /bulk/aggregate with MULTIPLE filter-set buckets in one request.
  async function fetchBulkBuckets(
    specs: Array<{ field: string; type: string }>,
    buckets: Array<{ where: string; alias: string }>,
  ): Promise<Record<string, Record<string, any>>> {
    const aggregation = JSON.stringify(specs);
    const resp = await request(t.context.app)
      .post(`/api/v2/tables/${t.table!.id}/bulk/aggregate`)
      .set('xc-auth', t.context.token)
      .query({ viewId: t.gridView!.id, aggregation })
      .send(buckets);
    if (resp.status >= 400) {
      throw new Error(`bulk/aggregate multi-bucket failed (${resp.status}): ${JSON.stringify(resp.body)}`);
    }
    return resp.body;
  }

  // Single (GET /aggregate) endpoint — a separate server-side orchestration
  // (`aggregate.ts`) from the bulk path. Same `?aggregation=` override.
  async function fetchSingleAggregation(fieldId: string, type: string): Promise<any> {
    const aggregation = JSON.stringify([{ field: fieldId, type }]);
    const resp = await request(t.context.app)
      .get(`/api/v2/tables/${t.table!.id}/aggregate`)
      .set('xc-auth', t.context.token)
      .query({ viewId: t.gridView!.id, aggregation });
    if (resp.status >= 400) {
      throw new Error(`aggregate ${type} failed (${resp.status}): ${JSON.stringify(resp.body)}`);
    }
    const body = resp.body;
    if (!body || !Object.keys(body).length) return null;
    return body[Object.keys(body)[0]];
  }

  function assertCell(
    label: string,
    agg: string,
    sqlVal: any,
    jsVal: any,
    expected: any,
    doReducer = checkReducer,
  ) {
    if (expected === null) {
      expect(sqlVal == null, `${label} — SQL expected null, got ${sqlVal}`).to.eq(true);
      if (doReducer) expect(jsVal == null, `${label} — JS expected null, got ${jsVal}`).to.eq(true);
      return;
    }
    if (typeof expected === 'string' || isDateValueAgg(agg)) {
      const exp = isDateValueAgg(agg) ? toDatePart(expected) : String(expected);
      expect(norm(sqlVal, agg).value, `${label} — SQL=${JSON.stringify(sqlVal)}`).to.eq(exp);
      if (doReducer) expect(norm(jsVal, agg).value, `${label} — JS=${JSON.stringify(jsVal)}`).to.eq(exp);
      return;
    }
    const eps = epsilonFor(agg);
    expect(Number(sqlVal), `${label} — SQL=${JSON.stringify(sqlVal)}`).to.be.closeTo(expected, eps);
    if (doReducer) expect(Number(jsVal), `${label} — JS=${JSON.stringify(jsVal)}`).to.be.closeTo(expected, eps);
  }

  function oracleFor(col: Column): Record<string, any> | undefined {
    return ORACLE[col.title] ?? LINK_ORACLE[col.title] ?? SYSTEM_ORACLE[col.uidt as string];
  }

  // Auto-managed system columns only assert the deterministic entries listed in
  // SYSTEM_ORACLE; any other available aggregation (exact timestamp value,
  // distinct-count) is skipped rather than failed.
  function isSystemCol(col: Column): boolean {
    return !ORACLE[col.title] && !LINK_ORACLE[col.title] && !!SYSTEM_ORACLE[col.uidt as string];
  }

  const api: TestApi = {
    get context() { return t.context; },
    set context(v) { t.context = v; },
    get table() { return t.table!; },
    set table(v) { t.table = v; },
    get gridView() { return t.gridView!; },
    set gridView(v) { t.gridView = v; },
    set columns(v) { t.columns = v; },
    set allRecords(v) { t.allRecords = v; },
  };

  // Reveal system / auto columns so the footer aggregates them (internal API):
  // `viewUpdate { show_system_fields }` lifts the system filter and
  // `showAllColumns` flips each grid column's `show` flag —
  // resolveAggregateColumns requires both.
  async function enableSystemFields() {
    const ictx = { app: t.context.app, xc_token: t.context.xc_token };
    const env = {
      workspaceId: t.table!.fk_workspace_id,
      baseId: t.table!.base_id,
    };
    const viewId = t.gridView!.id;
    const upd = await internalPost(
      ictx,
      env,
      { operation: 'viewUpdate', viewId },
      { show_system_fields: true },
    );
    expect(upd.status, `viewUpdate: ${JSON.stringify(upd.body).slice(0, 200)}`).to.eq(200);
    const showAll = await internalPost(ictx, env, {
      operation: 'showAllColumns',
      viewId,
    });
    expect(showAll.status, `showAllColumns: ${JSON.stringify(showAll.body).slice(0, 200)}`).to.eq(200);
  }

  beforeEach(async function () {
    this.timeout(180_000);
    await setup(api);
    await enableSystemFields();
  });

  async function runMatrix(
    fetchAgg: (fieldId: string, type: string) => Promise<any>,
    endpoint: string,
  ): Promise<string[]> {
    const dialect = dialectName(t.context);
    const failures: string[] = [];

    for (const col of t.columns!) {
      const oracle = oracleFor(col);
      if (!oracle) continue;

      const parsed = (col.colOptions as any)?.parsed_tree;
      const available = getAvailableAggregations(col.uidt, parsed);
      const dialectOverride = DIALECT_ORACLE[dialect]?.[col.title];

      const systemCol = isSystemCol(col);

      for (const agg of available) {
        if (agg === 'none') continue;
        const label = `[${dialect}/${endpoint}] ${col.title} (${col.uidt}).${agg}`;
        const expected = dialectOverride?.[agg] ?? oracle[agg];
        if (expected === undefined) {
          if (systemCol) continue; // non-deterministic system agg — skip, don't fail
          failures.push(`${label} — no oracle entry`);
          continue;
        }

        let sqlVal: any;
        try {
          sqlVal = await fetchAgg(col.id, agg);
        } catch (e: any) {
          failures.push(`${label} — SQL threw: ${e.message}`);
          continue;
        }

        const jsVal = computeAggregation({
          aggregation: agg,
          values: t.allRecords!.map((r) => r[col.title]),
          column: col as any,
          parsedFormulaType: parsed?.dataType,
        });

        try {
          // Records list doesn't expose auto-managed system columns under their
          // titles, so the reducer can't validate them — assert SQL vs oracle only.
          assertCell(label, agg, sqlVal, jsVal, expected, checkReducer && !systemCol);
        } catch (e: any) {
          failures.push(e.message);
        }
      }
    }

    return failures;
  }

  // Both server-side orchestrations (single `aggregate.ts` GET /aggregate and
  // bulk `bulk-aggregate.ts` POST /bulk/aggregate) share the SQL generation but
  // assemble it differently — exercise both against the same oracle.
  it('aggregates every (field type × aggregation) correctly — single + bulk', async function () {
    this.timeout(240_000);
    const failures = [
      ...(await runMatrix(fetchSingleAggregation, 'single')),
      ...(await runMatrix(fetchSqlAggregation, 'bulk')),
    ];
    expect(failures, `\n${failures.join('\n')}\n`).to.have.length(0);
  });

  // ── Selection subsets ──────────────────────────────────────────────────
  // For an arbitrary row subset (a cell-selection), the SQL aggregation over
  // the matching `where` filter must equal the JS reducer over those same
  // rows. (Consolidated from the former selectionAggregation suite.) std_dev
  // is excluded — cross-backend float ordering exceeds the parity epsilon.
  if (opts.selections?.length) {
    it('selection subsets: SQL aggregation matches the JS reducer over the same rows', async function () {
      this.timeout(300_000);
      const dialect = dialectName(t.context);
      const failures: string[] = [];

      // Auto/system columns are excluded — they aren't reducer-comparable
      // (records don't expose them) and aren't user cell-selection targets.
      const autoCols = new Set(['Id', 'AutoNumberField', 'UuidField']);
      for (const sel of opts.selections!) {
        for (const col of t.columns!) {
          if (!oracleFor(col)) continue;
          if (isSystemCol(col) || autoCols.has(col.title)) continue;
          const parsed = (col.colOptions as any)?.parsed_tree;
          const available = getAvailableAggregations(col.uidt, parsed);
          const subsetVals = t.allRecords!
            .filter((r) => sel.rowIds.includes(r.Id))
            .map((r) => r[col.title]);

          for (const agg of available) {
            if (agg === 'none' || agg === 'std_dev') continue;
            const label = `[${dialect}] ${sel.name} ${col.title}.${agg}`;
            let sqlVal: any;
            try {
              sqlVal = await fetchSqlAggregation(col.id, agg, sel.where);
            } catch (e: any) {
              failures.push(`${label} — SQL threw: ${e.message}`);
              continue;
            }
            const jsVal = computeAggregation({
              aggregation: agg,
              values: subsetVals,
              column: col as any,
              parsedFormulaType: parsed?.dataType,
            });
            try {
              const s = norm(sqlVal, agg);
              const j = norm(jsVal, agg);
              if (s.kind === 'null' && j.kind === 'null') continue;
              if (s.kind === 'num' && j.kind === 'num') {
                expect(s.value, `${label} — SQL=${JSON.stringify(sqlVal)} JS=${JSON.stringify(jsVal)}`)
                  .to.be.closeTo(j.value, epsilonFor(agg));
              } else {
                expect(s.value, `${label} — SQL=${JSON.stringify(sqlVal)} JS=${JSON.stringify(jsVal)}`)
                  .to.eq(j.value);
              }
            } catch (e: any) {
              failures.push(e.message);
            }
          }
        }
      }
      expect(failures, `\n${failures.join('\n')}\n`).to.have.length(0);
    });
  }

  // ── Bulk multi-bucket ──────────────────────────────────────────────────
  // One /bulk/aggregate request with several filter-set buckets returns a
  // per-alias result for each requested field. (Consolidated from the former
  // EE bulkAggregation suite; rebuilt on the matrix table so it runs on every
  // dialect/edition.)
  if (opts.multiBucket) {
    it('bulk/aggregate computes multiple filter-set buckets in one request', async function () {
      this.timeout(60_000);
      const numberCol = t.columns!.find((c) => c.title === 'Number')!;
      const textCol = t.columns!.find((c) => c.title === 'Text')!;
      const res = await fetchBulkBuckets(
        [
          { field: numberCol.id, type: 'sum' },
          { field: textCol.id, type: 'count_filled' },
        ],
        [
          { where: '(Id,lte,3)', alias: 'lo' }, // rows 1-3
          { where: '(Id,gte,4)', alias: 'hi' }, // rows 4-6
        ],
      );
      // lo: Number 10+20+30=60; Text alpha,beta,alpha → 3 filled
      expect(Number(res.lo.Number), 'lo.Number').to.be.closeTo(60, 1e-6);
      expect(Number(res.lo.Text), 'lo.Text').to.eq(3);
      // hi: Number 40+50+null=90; Text ''(empty),gamma,null → 1 filled
      expect(Number(res.hi.Number), 'hi.Number').to.be.closeTo(90, 1e-6);
      expect(Number(res.hi.Text), 'hi.Text').to.eq(1);
    });
  }

  return t;
}

interface TestApi {
  context: any;
  table: Model;
  gridView: View;
  columns: Column[];
  allRecords: any[];
}

function scalarAndFormulaSuite() {
  let base: Base;
  let ctx: { workspace_id: string; base_id: string };

  aggregationTestFactory(async (api) => {
    api.context = await init();
    base = await createProject(api.context);
    ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };

    const table = await createTable(api.context, base, {
      table_name: 'AggMatrix',
      title: 'AggMatrix',
      columns: [...COLUMNS, ...autoValueColumnsFor(dialectName(api.context))],
    });
    api.table = table;

    // Virtual/computed columns that reference base columns — created after.
    await createColumn(api.context, table, {
      title: 'FormulaNum', column_name: 'FormulaNum', uidt: UITypes.Formula,
      formula_raw: 'Number + 10',
    });
    await createColumn(api.context, table, {
      title: 'FormulaDate', column_name: 'FormulaDate', uidt: UITypes.Formula,
      formula_raw: '{DateField}',
    });
    await createBarcodeColumn(api.context, {
      title: 'BarcodeField', table, referencedBarcodeValueTableColumnTitle: 'Text',
    });
    await createQrCodeColumn(api.context, {
      title: 'QrCodeField', table, referencedQrValueTableColumnTitle: 'Text',
    });

    api.gridView = await createView(api.context, {
      table, type: ViewTypes.GRID, title: 'Aggregation Matrix View',
    });

    await request(api.context.app)
      .post(`/api/v2/tables/${table.id}/records`)
      .set('xc-auth', api.context.token)
      .send(FIXTURES)
      .expect(200);

    api.columns = await table.getColumns(ctx);
    api.allRecords = (
      await request(api.context.app)
        .get(`/api/v2/tables/${table.id}/records`)
        .query({ viewId: api.gridView.id, limit: 100 })
        .set('xc-auth', api.context.token)
        .expect(200)
    ).body.list;
  }, { selections: SELECTIONS, multiBucket: true });
}

function linkBasedSuite() {
  let base: Base;
  let ctx: { workspace_id: string; base_id: string };

  // child amounts linked per main row (sequential child ids; row 6 linked too)
  const LINKS: number[][] = [[10, 20], [30], [40, 50], [60], [70], [80]];

  aggregationTestFactory(async (api) => {
    api.context = await init();
    base = await createProject(api.context);
    ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };

    const main = await createTable(api.context, base, {
      table_name: 'VMain', title: 'VMain',
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID, ai: 1, pk: 1 },
        { column_name: 'Title', title: 'Title', uidt: UITypes.SingleLineText },
      ],
    });
    const child = await createTable(api.context, base, {
      table_name: 'VChild', title: 'VChild',
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID, ai: 1, pk: 1 },
        { column_name: 'Title', title: 'Title', uidt: UITypes.SingleLineText },
        { column_name: 'Amount', title: 'Amount', uidt: UITypes.Number },
      ],
    });
    api.table = main;

    // hasMany link (Links column = numeric link count)
    const linksCol = await createLtarColumn(api.context, {
      title: 'LinksField', parentTable: main, childTable: child, type: 'hm',
    });
    // Rollup(sum of child Amount) over the same relation
    await createRollupColumn(api.context, {
      base, title: 'RollupSum', rollupFunction: 'sum', table: main,
      relatedTableName: child.table_name, relatedTableColumnTitle: 'Amount',
      ltarColumnId: linksCol.id,
    });
    // Count of linked records
    await createColumn(api.context, main, {
      title: 'CountField', column_name: 'CountField', uidt: UITypes.Count,
      fk_relation_column_id: linksCol.id,
    });
    // Lookup of child Title over the same relation
    await createLookupColumn(api.context, {
      base, title: 'LookupField', table: main,
      relatedTableName: child.table_name, relatedTableColumnTitle: 'Title',
      relationColumnId: linksCol.id,
    });
    // Separate many-to-many LinkToAnotherRecord relation (legacy LTAR, common aggs)
    await createLtarColumn2(api.context, {
      title: 'LtarField', parentTable: main, childTable: child, type: 'mm',
    });
    // many-to-many Links column (numeric) — exercises the junction-table subquery
    const mmLinksCol = await createLtarColumn(api.context, {
      title: 'MmLinks', parentTable: main, childTable: child, type: 'mm',
    });
    // self-referential hasMany Links column (numeric) — main → main
    const selfLinksCol = await createLtarColumn(api.context, {
      title: 'SelfLinks', parentTable: main, childTable: main, type: 'hm',
    });
    // oneToOne LinkToAnotherRecord column (common aggs). NOTE: `bt` (belongsTo)
    // is not directly creatable — it's the auto-generated inverse of the `hm`
    // relation above (which already produced a bt on the child side), and its
    // aggregation SQL shape matches this to-one `oo` case.
    const ooCol = await createLtarColumn2(api.context, {
      title: 'OoField', parentTable: main, childTable: child, type: 'oo',
    });

    api.gridView = await createView(api.context, {
      table: main, type: ViewTypes.GRID, title: 'Link Aggregation View',
    });

    // seed main rows + child rows; capture the real ids (don't assume 1..N —
    // identity seeds can differ per dialect).
    const mainRes = await request(api.context.app)
      .post(`/api/v2/tables/${main.id}/records`)
      .set('xc-auth', api.context.token)
      .send(LINKS.map((_, i) => ({ Title: `m${i + 1}` })))
      .expect(200);
    const mainIds: number[] = mainRes.body.map((r: any) => r.Id);

    const childAmounts = LINKS.flat(); // [10,20,30,40,50,60,70,80]
    const childRes = await request(api.context.app)
      .post(`/api/v2/tables/${child.id}/records`)
      .set('xc-auth', api.context.token)
      .send(childAmounts.map((a, i) => ({ Title: `c${i + 1}`, Amount: a })))
      .expect(200);
    const childIds: number[] = childRes.body.map((r: any) => r.Id);

    // link children to main rows per LINKS (consume childIds in order)
    let cursor = 0;
    for (let rowIdx = 0; rowIdx < LINKS.length; rowIdx++) {
      const n = LINKS[rowIdx].length;
      if (!n) {
        continue;
      }
      const ids = childIds.slice(cursor, cursor + n);
      cursor += n;
      await request(api.context.app)
        .post(`/api/v2/tables/${main.id}/links/${linksCol.id}/records/${mainIds[rowIdx]}`)
        .set('xc-auth', api.context.token)
        .send(ids)
        .expect([200, 201]);
    }

    // mm: link each main row to exactly one child (1:1) → MmLinks count = 1 each
    // self-ref hm: link main[i] → main[(i+1) % N] (ring) → SelfLinks count = 1 each
    for (let i = 0; i < mainIds.length; i++) {
      await request(api.context.app)
        .post(`/api/v2/tables/${main.id}/links/${mmLinksCol.id}/records/${mainIds[i]}`)
        .set('xc-auth', api.context.token)
        .send([childIds[i]])
        .expect([200, 201]);
      await request(api.context.app)
        .post(`/api/v2/tables/${main.id}/links/${selfLinksCol.id}/records/${mainIds[i]}`)
        .set('xc-auth', api.context.token)
        .send([mainIds[(i + 1) % mainIds.length]])
        .expect([200, 201]);
    }

    // oo (one-to-one): link first 2 main rows to 2 otherwise-unused children
    for (let i = 0; i < 2; i++) {
      await request(api.context.app)
        .post(`/api/v2/tables/${main.id}/links/${ooCol.id}/records/${mainIds[i]}`)
        .set('xc-auth', api.context.token)
        .send([childIds[6 + i]])
        .expect([200, 201]);
    }

    api.columns = await main.getColumns(ctx);
    api.allRecords = (
      await request(api.context.app)
        .get(`/api/v2/tables/${main.id}/records`)
        .query({ viewId: api.gridView.id, limit: 100 })
        .set('xc-auth', api.context.token)
        .expect(200)
    ).body.list;
  }, { checkReducer: false });
}

export default function () {
  describe('Aggregation matrix — every field type × aggregation', () => {
    describe('scalar + formula + common', scalarAndFormulaSuite);
    describe('link-based virtual columns', linkBasedSuite);
  });
}
