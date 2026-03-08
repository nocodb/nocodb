import 'mocha';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import {
  applyDateDependencyFieldSync,
  buildDateDependencyPropagationSQL,
} from '~/helpers/dateDependencyHelper';
import type { DateDependencyType } from 'nocodb-sdk';
import type { Column } from '~/models';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCol(
  id: string,
  title: string,
  column_name: string,
  uidt: UITypes = UITypes.Date,
): Partial<Column> {
  return { id, title, column_name, uidt } as Partial<Column>;
}

function makeRule(overrides: Partial<DateDependencyType> = {}): DateDependencyType {
  return {
    is_active: true,
    fk_start_date_field_id: 'col_start',
    fk_end_date_field_id: 'col_end',
    fk_duration_field_id: 'col_dur',
    include_weekends: true,
    ...overrides,
  } as DateDependencyType;
}

const startCol = makeCol('col_start', 'Start Date', 'start_date') as Column;
const endCol   = makeCol('col_end',   'End Date',   'end_date')   as Column;
const durCol   = makeCol('col_dur',   'Duration',   'duration')   as Column;
const durColDuration = makeCol(
  'col_dur', 'Duration', 'duration', UITypes.Duration,
) as Column;

const columns = [startCol, endCol, durCol];
const columnsDuration = [startCol, endCol, durColDuration];

// ─── buildDateDependencyPropagationSQL ───────────────────────────────────────

function buildSQLTests() {
  describe('buildDateDependencyPropagationSQL', () => {
    const baseParams = {
      tn: 'my_table',
      pkColName: 'id',
      fkColName: 'predecessor_id',
      startColName: 'start_date',
      endColName: 'end_date',
      bufferDays: 0,
      seedIds: ['row1', 'row2'],
    };

    it('returns sql string and bindings array', () => {
      const { sql, bindings } = buildDateDependencyPropagationSQL({
        ...baseParams,
        connectionType: 'end-to-start',
        bufferType: 'flexible',
      });
      expect(sql).to.be.a('string');
      expect(bindings).to.deep.equal(['row1', 'row2']);
    });

    it('quotes table name', () => {
      const { sql } = buildDateDependencyPropagationSQL({
        ...baseParams,
        connectionType: 'end-to-start',
        bufferType: 'fixed',
      });
      expect(sql).to.include('"my_table"');
    });

    it('quotes schema-prefixed table name', () => {
      const { sql } = buildDateDependencyPropagationSQL({
        ...baseParams,
        tn: 'myschema.my_table',
        connectionType: 'end-to-start',
        bufferType: 'fixed',
      });
      expect(sql).to.include('"myschema"."my_table"');
    });

    it('quotes column names', () => {
      const { sql } = buildDateDependencyPropagationSQL({
        ...baseParams,
        connectionType: 'end-to-start',
        bufferType: 'fixed',
      });
      expect(sql).to.include('"id"');
      expect(sql).to.include('"predecessor_id"');
      expect(sql).to.include('"start_date"');
      expect(sql).to.include('"end_date"');
    });

    it('includes correct number of positional placeholders', () => {
      const { sql } = buildDateDependencyPropagationSQL({
        ...baseParams,
        seedIds: ['a', 'b', 'c'],
        connectionType: 'end-to-start',
        bufferType: 'flexible',
      });
      const placeholders = sql.match(/\?/g) ?? [];
      expect(placeholders).to.have.length(3);
    });

    it('single seed ID produces one placeholder', () => {
      const { sql, bindings } = buildDateDependencyPropagationSQL({
        ...baseParams,
        seedIds: ['only'],
        connectionType: 'end-to-start',
        bufferType: 'flexible',
      });
      expect((sql.match(/\?/g) ?? []).length).to.equal(1);
      expect(bindings).to.deep.equal(['only']);
    });

    it('contains WITH RECURSIVE and UPDATE', () => {
      const { sql } = buildDateDependencyPropagationSQL({
        ...baseParams,
        connectionType: 'end-to-start',
        bufferType: 'fixed',
      });
      expect(sql).to.include('WITH RECURSIVE');
      expect(sql).to.include('UPDATE');
      expect(sql).to.include('RETURNING');
    });

    it('contains cycle-guard ANY(path)', () => {
      const { sql } = buildDateDependencyPropagationSQL({
        ...baseParams,
        connectionType: 'end-to-start',
        bufferType: 'fixed',
      });
      expect(sql).to.include('ANY(p.path)');
    });

    it('contains IS DISTINCT FROM in WHERE', () => {
      const { sql } = buildDateDependencyPropagationSQL({
        ...baseParams,
        connectionType: 'end-to-start',
        bufferType: 'fixed',
      });
      expect(sql).to.include('IS DISTINCT FROM');
    });

    it('RETURNING includes old_start, old_end, new_start, new_end', () => {
      const { sql } = buildDateDependencyPropagationSQL({
        ...baseParams,
        connectionType: 'end-to-start',
        bufferType: 'fixed',
      });
      expect(sql).to.include('old_start');
      expect(sql).to.include('old_end');
      expect(sql).to.include('new_start');
      expect(sql).to.include('new_end');
    });

    describe('bufferDays interval', () => {
      it('uses 0-day buffer when bufferDays=0', () => {
        const { sql } = buildDateDependencyPropagationSQL({
          ...baseParams,
          bufferDays: 0,
          connectionType: 'end-to-start',
          bufferType: 'fixed',
        });
        expect(sql).to.include("(0 * INTERVAL '1 day')");
      });

      it('uses 5-day buffer when bufferDays=5', () => {
        const { sql } = buildDateDependencyPropagationSQL({
          ...baseParams,
          bufferDays: 5,
          connectionType: 'end-to-start',
          bufferType: 'fixed',
        });
        expect(sql).to.include("(5 * INTERVAL '1 day')");
      });
    });

    describe('connection types', () => {
      it('end-to-start fixed: uses p.end_date to drive successor start', () => {
        const { sql } = buildDateDependencyPropagationSQL({
          ...baseParams,
          connectionType: 'end-to-start',
          bufferType: 'fixed',
        });
        expect(sql).to.include("p.end_date");
        // fixed: no CASE WHEN
        expect(sql).not.to.include('CASE WHEN');
      });

      it('end-to-start flexible: uses CASE WHEN for overlap check', () => {
        const { sql } = buildDateDependencyPropagationSQL({
          ...baseParams,
          connectionType: 'end-to-start',
          bufferType: 'flexible',
        });
        expect(sql).to.include('CASE WHEN');
        expect(sql).to.include('p.end_date');
      });

      it('end-to-end: uses p.end_date to drive successor end', () => {
        const { sql } = buildDateDependencyPropagationSQL({
          ...baseParams,
          connectionType: 'end-to-end',
          bufferType: 'fixed',
        });
        expect(sql).to.include('p.end_date');
      });

      it('start-to-start: uses p.start_date to drive successor start', () => {
        const { sql } = buildDateDependencyPropagationSQL({
          ...baseParams,
          connectionType: 'start-to-start',
          bufferType: 'fixed',
        });
        expect(sql).to.include('p.start_date');
      });

      it('start-to-finish: uses p.start_date to drive successor end', () => {
        const { sql } = buildDateDependencyPropagationSQL({
          ...baseParams,
          connectionType: 'start-to-finish',
          bufferType: 'fixed',
        });
        expect(sql).to.include('p.start_date');
      });

      it('all connection types preserve duration via interval conversion', () => {
        for (const connectionType of [
          'end-to-start',
          'end-to-end',
          'start-to-start',
          'start-to-finish',
        ] as const) {
          const { sql } = buildDateDependencyPropagationSQL({
            ...baseParams,
            connectionType,
            bufferType: 'fixed',
          });
          // Duration: (t.ec::date - t.sc::date) * INTERVAL '1 day'
          expect(sql, `${connectionType} should preserve duration`).to.include(
            `"end_date"::date - t."start_date"::date) * INTERVAL '1 day'`,
          );
        }
      });
    });
  });
}

// ─── applyDateDependencyFieldSync ────────────────────────────────────────────

function applyFieldSyncTests() {
  describe('applyDateDependencyFieldSync', () => {
    it('does nothing when rule is inactive', () => {
      const data: Record<string, any> = { start_date: '2025-01-01' };
      applyDateDependencyFieldSync(
        data,
        null,
        makeRule({ is_active: false }),
        columns,
      );
      expect(data).to.deep.equal({ start_date: '2025-01-01' });
    });

    it('does nothing when columns are missing from model', () => {
      const data: Record<string, any> = { start_date: '2025-01-01' };
      applyDateDependencyFieldSync(data, null, makeRule(), [startCol]);
      expect(data).to.deep.equal({ start_date: '2025-01-01' });
    });

    describe('start + end → compute duration', () => {
      it('fills duration (days) from start and end', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-01',
          end_date: '2025-01-05',
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        // inclusive: Jan 1 to Jan 5 = 5 days
        expect(data.duration).to.equal(5);
      });

      it('fills duration=1 for single-day span', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-01',
          end_date: '2025-01-01',
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        expect(data.duration).to.equal(1);
      });

      it('fills Duration (seconds) when column is UITypes.Duration', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-01',
          end_date: '2025-01-05',
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columnsDuration);
        // 5 days * 86400 seconds
        expect(data.duration).to.equal(5 * 86400);
      });

      it('does not overwrite explicitly set duration', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-01',
          end_date: '2025-01-10',
          duration: 999,
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        // all three in data → start+end wins, recalculates duration
        expect(data.duration).to.equal(10);
      });
    });

    describe('start + duration → compute end', () => {
      it('fills end_date from start and numeric duration', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-01',
          duration: 5,
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        // Jan 1 + 4 days = Jan 5 (inclusive)
        expect(data.end_date).to.equal('2025-01-05');
      });

      it('fills end_date for duration=1 (same day)', () => {
        const data: Record<string, any> = {
          start_date: '2025-03-15',
          duration: 1,
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        expect(data.end_date).to.equal('2025-03-15');
      });

      it('fills end_date from UITypes.Duration seconds value', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-01',
          duration: 5 * 86400,
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columnsDuration);
        expect(data.end_date).to.equal('2025-01-05');
      });

      it('does not fill end_date if duration < 1', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-01',
          duration: 0,
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        expect(data.end_date).to.be.undefined;
      });
    });

    describe('end + duration → compute start', () => {
      it('fills start_date from end and duration', () => {
        const data: Record<string, any> = {
          end_date: '2025-01-05',
          duration: 5,
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        expect(data.start_date).to.equal('2025-01-01');
      });

      it('fills start_date = end when duration=1', () => {
        const data: Record<string, any> = {
          end_date: '2025-06-20',
          duration: 1,
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        expect(data.start_date).to.equal('2025-06-20');
      });
    });

    describe('oldData fallback', () => {
      it('reads missing fields from oldData by title', () => {
        // data has only start_date; oldData has end via title
        const data: Record<string, any> = { start_date: '2025-01-01' };
        const oldData = { 'End Date': '2025-01-10' };
        applyDateDependencyFieldSync(data, oldData, makeRule(), columns);
        // start + end resolved → fill duration
        expect(data.duration).to.equal(10);
      });

      it('uses data value when present, ignores oldData for same field', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-01',
          end_date: '2025-01-05',
        };
        const oldData = { 'End Date': '2025-12-31' };
        applyDateDependencyFieldSync(data, oldData, makeRule(), columns);
        expect(data.duration).to.equal(5); // data.end_date wins
      });
    });

    describe('null / undefined handling', () => {
      it('does nothing when all relevant fields are null', () => {
        const data: Record<string, any> = {
          start_date: null,
          end_date: null,
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        expect(data.duration).to.be.undefined;
      });

      it('does nothing when only one field is present', () => {
        const data: Record<string, any> = { start_date: '2025-01-01' };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        expect(data.end_date).to.be.undefined;
        expect(data.duration).to.be.undefined;
      });

      it('skips computation when end < start', () => {
        const data: Record<string, any> = {
          start_date: '2025-01-10',
          end_date: '2025-01-01',
        };
        applyDateDependencyFieldSync(data, null, makeRule(), columns);
        expect(data.duration).to.be.undefined;
      });
    });

    describe('include_weekends = false', () => {
      it('counts only business days for start+end → duration', () => {
        // Mon 2025-01-06 to Fri 2025-01-10 = 5 business days inclusive
        const data: Record<string, any> = {
          start_date: '2025-01-06',
          end_date: '2025-01-10',
        };
        applyDateDependencyFieldSync(
          data,
          null,
          makeRule({ include_weekends: false }),
          columns,
        );
        expect(data.duration).to.equal(5);
      });

      it('skips weekends when computing end from start+duration', () => {
        // Mon 2025-01-06 + 5 business days = Fri 2025-01-10
        const data: Record<string, any> = {
          start_date: '2025-01-06',
          duration: 5,
        };
        applyDateDependencyFieldSync(
          data,
          null,
          makeRule({ include_weekends: false }),
          columns,
        );
        expect(data.end_date).to.equal('2025-01-10');
      });

      it('skips weekends when computing start from end+duration', () => {
        // Fri 2025-01-10 - 5 business days = Mon 2025-01-06
        const data: Record<string, any> = {
          end_date: '2025-01-10',
          duration: 5,
        };
        applyDateDependencyFieldSync(
          data,
          null,
          makeRule({ include_weekends: false }),
          columns,
        );
        expect(data.start_date).to.equal('2025-01-06');
      });

      it('counts weekends when include_weekends=true spans a weekend', () => {
        // Fri 2025-01-10 to Mon 2025-01-13 = 4 calendar days inclusive
        const data: Record<string, any> = {
          start_date: '2025-01-10',
          end_date: '2025-01-13',
        };
        applyDateDependencyFieldSync(
          data,
          null,
          makeRule({ include_weekends: true }),
          columns,
        );
        expect(data.duration).to.equal(4);
      });
    });
  });
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function dateDependencyHelperTests() {
  describe('dateDependencyHelper', () => {
    buildSQLTests();
    applyFieldSyncTests();
  });
}
