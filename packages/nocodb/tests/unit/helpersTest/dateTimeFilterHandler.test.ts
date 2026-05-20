import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { DateTimeGeneralHandler } from '~/db/field-handler/handlers/date-time/date-time.general.handler';
import type CustomKnex from '~/db/CustomKnex';
import type { Column, Filter } from '~/models';

// Regression coverage for nocodb/nocodb#13101 — DateTime filter "is after" /
// "is before" combined with a relative sub-op ("number of days ago", etc.)
// crashed with `TypeError: i.replace is not a function` because the frontend
// `Decimal` input persists `filter.value` as a JS number, while
// `filterGt/Gte/Lt/Lte` called `filter.value.replace('T', ' ')` to detect a
// time component. The fix adds a `typeof filter.value === 'string'` guard.

const buildKnexStub = () =>
  ({
    raw: sinon.stub().callsFake((sql: string, bindings: any[]) => ({
      sql,
      bindings,
      toQuery: () => sql,
    })),
    clientType: sinon.stub().returns('pg'),
  }) as unknown as CustomKnex;

// Chainable Knex.QueryBuilder mock — `where` / `orWhere` MUST invoke the
// callback when called with a function (the date-time handler nests its real
// SQL emission inside `qb.where((nestedQb) => …)`). A plain `sinon.spy()`
// records the call but never runs the callback, so `comparisonOp` → `knex.raw`
// stays unreached and a broken implementation could still make the test pass.
const buildQbStub = () => {
  const qb: any = {};
  const invokeIfCallback = (arg: any) => {
    if (typeof arg === 'function') arg(qb);
    return qb;
  };
  qb.where = sinon.stub().callsFake(invokeIfCallback);
  qb.orWhere = sinon.stub().callsFake(invokeIfCallback);
  qb.orWhereNull = sinon.stub().returns(qb);
  return qb;
};

const buildColumn = (): Column =>
  ({
    column_name: 'CreatedAt',
    title: 'CreatedAt',
    meta: null,
  }) as unknown as Column;

const buildOptions = () =>
  ({
    alias: 't1',
    context: { timezone: 'UTC' },
  }) as any;

const buildFilter = (overrides: Partial<Filter>): Filter =>
  ({
    comparison_op: 'gt',
    comparison_sub_op: 'pastNumberOfDays',
    value: 14,
    meta: null,
    ...overrides,
  }) as unknown as Filter;

const sqlOpForComparison: Record<string, string> = {
  gt: '>',
  gte: '>=',
  ge: '>=',
  lt: '<',
  lte: '<=',
  le: '<=',
};

function dateTimeFilterHandlerTests() {
  describe('DateTimeGeneralHandler — relative-date filter value coercion (#13101)', () => {
    const handler = new DateTimeGeneralHandler();
    const relativeSubOps = [
      'daysAgo',
      'daysFromNow',
      'pastNumberOfDays',
      'nextNumberOfDays',
    ];
    const comparisonOps = ['gt', 'gte', 'ge', 'lt', 'lte', 'le'];

    for (const subOp of relativeSubOps) {
      for (const op of comparisonOps) {
        it(`accepts numeric filter.value for comparison_op="${op}" comparison_sub_op="${subOp}"`, async () => {
          const knex = buildKnexStub();
          const filter = buildFilter({
            comparison_op: op,
            comparison_sub_op: subOp,
            value: 14,
          });

          const result = await handler.filter(
            knex,
            filter,
            buildColumn(),
            buildOptions(),
          );

          expect(result).to.have.property('clause');
          expect(result.clause).to.be.a('function');

          // Drive the clause through `buildQbStub` so the nested where-callback
          // actually runs `comparisonOp`. If the typeof guard regresses, this
          // path will throw `TypeError: i.replace is not a function`.
          const qb = buildQbStub();
          result.clause(qb);

          const rawStub = knex.raw as unknown as sinon.SinonStub;
          expect(rawStub.callCount).to.be.at.least(1);
          const rawSql = rawStub.getCall(0).args[0] as string;
          expect(rawSql).to.equal(`?? ${sqlOpForComparison[op]} ?`);
        });
      }
    }

    it('still parses a string filter.value with a time component (no regression in original code path)', async () => {
      const knex = buildKnexStub();
      const filter = buildFilter({
        comparison_op: 'gt',
        comparison_sub_op: undefined,
        // value carries a time component — this is the path the typeof guard
        // protects: the legacy `.replace('T', ' ').split(' ')[1]` branch must
        // still trigger and route through parseFilterValue.
        value: '2026-05-15 12:30:00',
      });

      const parseSpy = sinon.spy(handler as any, 'parseFilterValue');
      try {
        const result = await handler.filter(
          knex,
          filter,
          buildColumn(),
          buildOptions(),
        );

        expect(result).to.have.property('clause');
        const qb = buildQbStub();
        result.clause(qb);
        expect((knex.raw as unknown as sinon.SinonStub).callCount).to.be.at.least(1);
        // The time-component branch is the only path that invokes parseFilterValue
        // inside filterGt/Gte/Lt/Lte — assert it actually fired.
        expect(parseSpy.called).to.be.true;
      } finally {
        parseSpy.restore();
      }
    });

    it('short-circuits to a no-op when relative-date value is null', async () => {
      const knex = buildKnexStub();
      const filter = buildFilter({
        comparison_op: 'gt',
        comparison_sub_op: 'daysAgo',
        value: null as any,
      });

      const result = await handler.filter(
        knex,
        filter,
        buildColumn(),
        buildOptions(),
      );

      expect(result).to.have.property('clause');
      const qb = buildQbStub();
      // Falsy value returns an empty-clause result — calling clause is a no-op
      // and must not throw.
      expect(() => result.clause(qb)).to.not.throw();
    });

    it('accepts a numeric-string filter.value (the reporter\'s "14" workaround) without entering parseFilterValue', async () => {
      const knex = buildKnexStub();
      const filter = buildFilter({
        comparison_op: 'gt',
        comparison_sub_op: 'pastNumberOfDays',
        value: '14',
      });

      const parseSpy = sinon.spy(handler as any, 'parseFilterValue');
      try {
        const result = await handler.filter(
          knex,
          filter,
          buildColumn(),
          buildOptions(),
        );

        expect(result).to.have.property('clause');
        const qb = buildQbStub();
        expect(() => result.clause(qb)).to.not.throw();
        // `'14'.replace('T', ' ').split(' ')[1]` is undefined, so the time-component
        // branch in filterGt must be skipped — parseFilterValue stays unreached.
        expect(parseSpy.called).to.be.false;
      } finally {
        parseSpy.restore();
      }
    });
  });
}

export function dateTimeFilterHandlerTest() {
  dateTimeFilterHandlerTests();
}
