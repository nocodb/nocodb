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

          // Exercise the clause to make sure SQL building also works end-to-end.
          const qb = { where: sinon.spy() } as any;
          result.clause(qb);
          expect(qb.where.callCount).to.be.at.least(1);
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

      const result = await handler.filter(
        knex,
        filter,
        buildColumn(),
        buildOptions(),
      );

      expect(result).to.have.property('clause');
      const qb = { where: sinon.spy() } as any;
      result.clause(qb);
      expect(qb.where.callCount).to.be.at.least(1);
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
      const qb = { where: sinon.spy() } as any;
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

      const result = await handler.filter(
        knex,
        filter,
        buildColumn(),
        buildOptions(),
      );

      expect(result).to.have.property('clause');
      const qb = { where: sinon.spy() } as any;
      expect(() => result.clause(qb)).to.not.throw();
    });
  });
}

export function dateTimeFilterHandlerTest() {
  dateTimeFilterHandlerTests();
}
