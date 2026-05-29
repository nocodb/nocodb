import { beforeEach } from 'mocha';
import request from 'supertest';
import { UITypes, ViewTypes, computeAggregation } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { customColumns } from '../../factory/column';
import { createView } from '../../factory/view';
import type { Base, Column, Model, View } from '~/models';

// Cross-validates the SDK's client-side aggregation reducers against the
// backend's SQL aggregation, both at the full-table footer level and over
// arbitrary subsets (mimicking cell selection). The whole point of
// selection-mode is that JS reducers must return what SQL would return for
// the same rows — drift here means the footer would silently lie.

const FIXTURES = [
  // Diverse rows: nulls, zeros, duplicates, varied numerics, varied dates.
  // Selection scenarios below pick subsets of these rows by Id.
  {
    Title: 'alpha',
    LongText: 'long alpha',
    Number: 10,
    Decimal: 1.5,
    Checkbox: true,
    Date: '2024-01-15',
    Currency: 100,
    Percent: 25,
    Duration: 600,
    Rating: 4,
    Year: 2024,
  },
  {
    Title: null,
    LongText: '',
    Number: null,
    Decimal: null,
    Checkbox: false,
    Date: '2024-03-20',
    Currency: 200,
    Percent: 50,
    Duration: null,
    Rating: 0,
    Year: 2024,
  },
  {
    Title: 'alpha', // duplicate of row 1 — exercises CountUnique
    LongText: 'long beta',
    Number: 20,
    Decimal: 2.5,
    Checkbox: true,
    Date: '2024-02-10',
    Currency: 100, // duplicate
    Percent: 75,
    Duration: 1200,
    Rating: 5,
    Year: 2025,
  },
  {
    Title: '', // empty string — exercises text empty predicate
    LongText: 'long gamma',
    Number: 30,
    Decimal: null,
    Checkbox: null,
    Date: null,
    Currency: 50.5,
    Percent: null,
    Duration: 300,
    Rating: 3,
    Year: 2025,
  },
  {
    Title: 'gamma',
    LongText: 'long delta',
    Number: 0, // zero — Number treats as filled, Rating would treat as empty
    Decimal: 0,
    Checkbox: false,
    Date: '2024-04-05',
    Currency: 0,
    Percent: 0,
    Duration: 0,
    Rating: 0,
    Year: 2026,
  },
  {
    Title: null,
    LongText: null,
    Number: 50,
    Decimal: 4.5,
    Checkbox: true,
    Date: '2025-01-01',
    Currency: 300.25,
    Percent: 100,
    Duration: 3600,
    Rating: 4,
    Year: 2025,
  },
];

interface Selection {
  name: string;
  where: string;
  rowIds: number[]; // 1-based ids matching insertion order
}

const SELECTIONS: Selection[] = [
  { name: 'full', where: '', rowIds: [1, 2, 3, 4, 5, 6] },
  { name: 'first-3', where: '(Id,lte,3)', rowIds: [1, 2, 3] },
  { name: 'last-3', where: '(Id,gte,4)', rowIds: [4, 5, 6] },
  {
    name: 'middle-3',
    where: '(Id,gte,2)~and(Id,lte,4)',
    rowIds: [2, 3, 4],
  },
  { name: 'single-3', where: '(Id,eq,3)', rowIds: [3] },
];

interface AggCase {
  field: string;
  uidt: UITypes;
  aggregations: string[];
  /** Optional tolerance for floating-point comparison (default 1e-6) */
  epsilon?: number;
}

const AGG_CASES: AggCase[] = [
  {
    field: 'Title',
    uidt: UITypes.SingleLineText,
    aggregations: [
      'count',
      'count_empty',
      'count_filled',
      'count_unique',
      'percent_empty',
      'percent_filled',
      'percent_unique',
    ],
  },
  {
    field: 'LongText',
    uidt: UITypes.LongText,
    aggregations: [
      'count',
      'count_empty',
      'count_filled',
      'count_unique',
      'percent_filled',
    ],
  },
  {
    field: 'Number',
    uidt: UITypes.Number,
    // std_dev is excluded from broad parity because its floating-point
    // result varies across backends slightly; the dedicated tests at the
    // bottom of the file pin its parity with the JS reducer on SQLite,
    // where the implementation is custom.
    aggregations: [
      'sum',
      'min',
      'max',
      'avg',
      'median',
      'range',
      'count_filled',
      'count_empty',
      'count_unique',
    ],
  },
  {
    field: 'Decimal',
    uidt: UITypes.Decimal,
    aggregations: ['sum', 'min', 'max', 'avg', 'range'],
    epsilon: 1e-3,
  },
  {
    field: 'Currency',
    uidt: UITypes.Currency,
    aggregations: ['sum', 'min', 'max', 'avg', 'range'],
    epsilon: 1e-3,
  },
  {
    field: 'Percent',
    uidt: UITypes.Percent,
    aggregations: ['sum', 'min', 'max', 'avg'],
  },
  {
    field: 'Duration',
    uidt: UITypes.Duration,
    aggregations: ['sum', 'min', 'max', 'avg', 'count_filled', 'count_empty'],
  },
  {
    field: 'Rating',
    uidt: UITypes.Rating,
    // Rating's quirks: Avg/Min/Range skip 0; Sum/Max include 0.
    aggregations: [
      'sum',
      'min',
      'max',
      'avg',
      'range',
      'count_empty',
      'count_filled',
      'count_unique',
      'percent_empty',
      'percent_filled',
    ],
  },
  {
    field: 'Checkbox',
    uidt: UITypes.Checkbox,
    aggregations: ['checked', 'unchecked', 'percent_checked', 'percent_unchecked'],
  },
  {
    field: 'Date',
    uidt: UITypes.Date,
    aggregations: [
      'earliest_date',
      'latest_date',
      'date_range',
      'month_range',
      'count_filled',
      'count_empty',
    ],
  },
];

function selectionAggregationTests() {
  let context: any;
  let ctx: { workspace_id: string; base_id: string };

  let base: Base;
  let table: Model;
  let columns: Array<Column>;
  let gridView: View;
  let allRecords: any[];

  beforeEach(async function () {
    this.timeout(60_000);
    context = await init();

    base = await createProject(context);
    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    table = await createTable(context, base, {
      columns: customColumns('aggregationBased'),
    });

    gridView = await createView(context, {
      table,
      type: ViewTypes.GRID,
      title: 'Selection Aggregation View',
    });

    columns = await table.getColumns(ctx);

    await request(context.app)
      .post(`/api/v2/tables/${table.id}/records`)
      .set('xc-auth', context.token)
      .send(FIXTURES)
      .expect(200);

    // Fetch every record so JS reducers operate on the same values the user
    // would see in cells.
    allRecords = (
      await request(context.app)
        .get(`/api/v2/tables/${table.id}/records`)
        .query({ viewId: gridView.id, limit: 100 })
        .set('xc-auth', context.token)
        .expect(200)
    ).body.list;
  });

  async function fetchSqlAggregation(
    fieldId: string,
    type: string,
    where: string
  ): Promise<any> {
    const aggregation = JSON.stringify([{ field: fieldId, type }]);
    const aliasKey = 'sub';
    const body = [{ where, alias: aliasKey }];
    const resp = await request(context.app)
      .post(`/api/v2/tables/${table.id}/bulk/aggregate`)
      .set('xc-auth', context.token)
      .query({ viewId: gridView.id, aggregation })
      .send(body);
    if (resp.status >= 400) {
      throw new Error(
        `bulk/aggregate failed (${resp.status}): ${JSON.stringify(resp.body)}`
      );
    }
    const bucket = resp.body[aliasKey];
    if (!bucket) return null;
    const keys = Object.keys(bucket);
    return bucket[keys[0]];
  }

  function valuesForSelection(field: string, rowIds: number[]): any[] {
    const idSet = new Set(rowIds);
    return allRecords.filter((r) => idSet.has(r.Id)).map((r) => r[field]);
  }

  function normalizeForCompare(
    value: any,
    aggregation: string,
    epsilon = 1e-6
  ): { kind: 'num' | 'str' | 'null'; value: any } {
    if (value === null || value === undefined) return { kind: 'null', value: null };
    // EarliestDate / LatestDate return the raw stored value — string compare
    if (aggregation === 'earliest_date' || aggregation === 'latest_date') {
      // Strip time component if present so SQL '2024-01-15 00:00:00' lines up
      // with the date-only stored value the JS reducer sees.
      const s = String(value);
      const datePart = s.split(/[ T]/)[0];
      return { kind: 'str', value: datePart };
    }
    // Numeric — coerce. PG sometimes returns SUM/AVG as strings.
    const n = Number(value);
    if (!Number.isFinite(n)) return { kind: 'str', value: String(value) };
    return { kind: 'num', value: n };
  }

  function assertClose(
    sql: any,
    js: any,
    epsilon: number,
    label: string
  ): void {
    const sqlNorm = normalizeForCompare(sql, '', epsilon);
    const jsNorm = normalizeForCompare(js, '', epsilon);
    if (sqlNorm.kind === 'null' && jsNorm.kind === 'null') return;
    if (sqlNorm.kind === 'num' && jsNorm.kind === 'num') {
      expect(sqlNorm.value).to.be.closeTo(jsNorm.value, epsilon, label);
      return;
    }
    expect(sqlNorm.value).to.equal(jsNorm.value, label);
  }

  async function compareSelection(
    aggCase: AggCase,
    aggregation: string,
    selection: Selection
  ) {
    const col = columns.find((c) => c.title === aggCase.field);
    if (!col) throw new Error(`Column ${aggCase.field} not found`);

    const sqlValue = await fetchSqlAggregation(
      col.id,
      aggregation,
      selection.where
    );

    const values = valuesForSelection(aggCase.field, selection.rowIds);
    const jsValue = computeAggregation({
      aggregation,
      values,
      column: col as any,
    });

    const sqlNorm = normalizeForCompare(sqlValue, aggregation);
    const jsNorm = normalizeForCompare(jsValue, aggregation);

    const label = `[${selection.name}] ${aggCase.field}.${aggregation} — SQL=${JSON.stringify(
      sqlValue
    )}, JS=${JSON.stringify(jsValue)}`;

    if (sqlNorm.kind === 'null' && jsNorm.kind === 'null') return;
    if (sqlNorm.kind === 'num' && jsNorm.kind === 'num') {
      expect(sqlNorm.value).to.be.closeTo(
        jsNorm.value,
        aggCase.epsilon ?? 1e-6,
        label
      );
      return;
    }
    expect(sqlNorm.value).to.equal(jsNorm.value, label);
  }

  it('full-table footer: SQL aggregation matches JS reducer', async function () {
    this.timeout(120_000);
    const fullSelection = SELECTIONS[0];
    for (const aggCase of AGG_CASES) {
      for (const aggregation of aggCase.aggregations) {
        await compareSelection(aggCase, aggregation, fullSelection);
      }
    }
  });

  it('selection subsets: SQL aggregation matches JS reducer for every (column, aggregation, subset)', async function () {
    this.timeout(180_000);
    for (const selection of SELECTIONS.slice(1)) {
      for (const aggCase of AGG_CASES) {
        for (const aggregation of aggCase.aggregations) {
          await compareSelection(aggCase, aggregation, selection);
        }
      }
    }
  });

  it('Rating: SQL and JS agree on the 0-skipping quirks (Avg / Min / Range exclude 0; Sum / Max include 0)', async function () {
    this.timeout(60_000);
    const ratingCase = AGG_CASES.find((c) => c.field === 'Rating')!;
    const subsetWithZeros: Selection = {
      name: 'rows-2-and-5-both-have-rating-0',
      where: '(Id,gte,2)~and(Id,lte,5)',
      rowIds: [2, 3, 4, 5],
    };
    for (const aggregation of ['sum', 'avg', 'min', 'max', 'range']) {
      await compareSelection(ratingCase, aggregation, subsetWithZeros);
    }
  });

  it('Checkbox: percent_checked + percent_unchecked === 100 across selections', async function () {
    this.timeout(60_000);
    const cbCol = columns.find((c) => c.title === 'Checkbox')!;
    for (const selection of SELECTIONS) {
      const checked = await fetchSqlAggregation(
        cbCol.id,
        'percent_checked',
        selection.where
      );
      const unchecked = await fetchSqlAggregation(
        cbCol.id,
        'percent_unchecked',
        selection.where
      );
      const sum = Number(checked) + Number(unchecked);
      expect(sum).to.be.closeTo(
        100,
        1e-6,
        `[${selection.name}] checked+unchecked = ${sum}`
      );
    }
  });

  // std_dev parity is pinned only on SQLite. The SQLite expression is a
  // hand-rolled SQRT(SUM((x-avg)^2)/N) over a derived table, whereas PG/MSSQL
  // use native population-stddev functions (`stddev_pop` / `STDEVP`) and
  // MySQL uses `STDDEV`. The math agrees in principle, but cross-backend
  // float ordering produces small differences that the 1e-6 epsilon used in
  // broad parity is too tight to absorb — so std_dev stays out of the broad
  // sweep and is pinned here for SQLite specifically.
  const sqliteOnlyDescribe =
    !process.env.DB_CLIENT ||
    process.env.DB_CLIENT === 'sqlite' ||
    process.env.DB_CLIENT === 'sqlite3'
      ? describe
      : describe.skip;

  sqliteOnlyDescribe('std_dev: SQLite-specific parity coverage', () => {
    it('std_dev: SQL honors selection filter (parity with JS subset)', async function () {
      this.timeout(30_000);
      const numberCol = columns.find((c) => c.title === 'Number')!;
      const sqlFull = Number(
        await fetchSqlAggregation(numberCol.id, 'std_dev', '')
      );
      const sqlSubset = Number(
        await fetchSqlAggregation(numberCol.id, 'std_dev', '(Id,lte,3)')
      );
      // The selection filter reaches the inner aggregate — a 3-row subset
      // computes a different stddev than the full 6-row table.
      expect(sqlSubset).to.not.be.closeTo(sqlFull, 1);

      // SQL subset agrees with JS-computed subset.
      const jsSubset = computeAggregation({
        aggregation: 'std_dev',
        values: allRecords.slice(0, 3).map((r) => r.Number),
        column: numberCol as any,
      }) as number;
      expect(sqlSubset).to.be.closeTo(jsSubset, 1e-6);
    });

    it('std_dev: agrees with JS at the full-table footer (no selection)', async function () {
      this.timeout(30_000);
      const numberCol = columns.find((c) => c.title === 'Number')!;
      const sqlFull = Number(
        await fetchSqlAggregation(numberCol.id, 'std_dev', '')
      );
      const jsFull = computeAggregation({
        aggregation: 'std_dev',
        values: allRecords.map((r) => r.Number),
        column: numberCol as any,
      }) as number;
      expect(sqlFull).to.be.closeTo(jsFull, 1e-6);
    });
  });
}

export default function () {
  describe('Selection-scoped aggregation parity', selectionAggregationTests);
}
