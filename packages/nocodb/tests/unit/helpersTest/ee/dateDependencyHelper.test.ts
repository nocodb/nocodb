import 'mocha';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import { applyDateDependencyFieldSync } from '~/helpers/dateDependencyHelper';
import type { DateDependencyType } from 'nocodb-sdk';
import type { Column } from '~/models';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCol(
  id: string,
  title: string,
  column_name: string,
  uidt: UITypes = UITypes.Date,
): Column {
  return { id, title, column_name, uidt } as Column;
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

const startCol     = makeCol('col_start', 'Start Date', 'start_date');
const endCol       = makeCol('col_end',   'End Date',   'end_date');
const durCol       = makeCol('col_dur',   'Duration',   'duration');
const durColSecs   = makeCol('col_dur',   'Duration',   'duration', UITypes.Duration);

const cols        = [startCol, endCol, durCol];
const colsSeconds = [startCol, endCol, durColSecs];

// ─── applyDateDependencyFieldSync ────────────────────────────────────────────

export function dateDependencyHelperTests() {
  describe('dateDependencyHelper', () => {
    describe('applyDateDependencyFieldSync', () => {

      describe('guard conditions', () => {
        it('should not modify data when rule is inactive', () => {
          const data: Record<string, any> = { start_date: '2025-01-01' };
          applyDateDependencyFieldSync(data, null, makeRule({ is_active: false }), cols);
          expect(data).to.deep.equal({ start_date: '2025-01-01' });
        });

        it('should not modify data when start column is missing from model', () => {
          const data: Record<string, any> = { end_date: '2025-01-10', duration: 5 };
          applyDateDependencyFieldSync(data, null, makeRule(), [endCol, durCol]);
          expect(data.start_date).to.be.undefined;
        });

        it('should not modify data when end column is missing from model', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', duration: 5 };
          applyDateDependencyFieldSync(data, null, makeRule(), [startCol, durCol]);
          expect(data.end_date).to.be.undefined;
        });

        it('should not modify data when duration column is missing from model', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', end_date: '2025-01-05' };
          applyDateDependencyFieldSync(data, null, makeRule(), [startCol, endCol]);
          expect(data.duration).to.be.undefined;
        });

        it('should do nothing when only one field is present and no oldData', () => {
          const data: Record<string, any> = { start_date: '2025-01-01' };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.end_date).to.be.undefined;
          expect(data.duration).to.be.undefined;
        });

        it('should do nothing when all relevant fields are null', () => {
          const data: Record<string, any> = { start_date: null, end_date: null, duration: null };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(Object.keys(data)).to.deep.equal(['start_date', 'end_date', 'duration']);
        });

        it('should not compute duration when end is before start', () => {
          const data: Record<string, any> = { start_date: '2025-01-10', end_date: '2025-01-01' };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.duration).to.be.undefined;
        });
      });

      describe('start + end → duration (Number field)', () => {
        it('should compute duration in days inclusive', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', end_date: '2025-01-05' };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.duration).to.equal(5);
        });

        it('should compute duration as 1 for same-day span', () => {
          const data: Record<string, any> = { start_date: '2025-03-15', end_date: '2025-03-15' };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.duration).to.equal(1);
        });

        it('should recalculate duration from start+end when all three are in data', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', end_date: '2025-01-10', duration: 999 };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.duration).to.equal(10);
        });
      });

      describe('start + end → duration (UITypes.Duration field — seconds)', () => {
        it('should convert days to seconds', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', end_date: '2025-01-05' };
          applyDateDependencyFieldSync(data, null, makeRule(), colsSeconds);
          expect(data.duration).to.equal(5 * 86400);
        });

        it('should return 86400 seconds for a same-day span', () => {
          const data: Record<string, any> = { start_date: '2025-05-01', end_date: '2025-05-01' };
          applyDateDependencyFieldSync(data, null, makeRule(), colsSeconds);
          expect(data.duration).to.equal(86400);
        });
      });

      describe('start + duration → end date', () => {
        it('should compute end date from start and duration', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', duration: 5 };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.end_date).to.equal('2025-01-05');
        });

        it('should set end = start when duration is 1', () => {
          const data: Record<string, any> = { start_date: '2025-03-15', duration: 1 };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.end_date).to.equal('2025-03-15');
        });

        it('should compute end date from UITypes.Duration (seconds) value', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', duration: 5 * 86400 };
          applyDateDependencyFieldSync(data, null, makeRule(), colsSeconds);
          expect(data.end_date).to.equal('2025-01-05');
        });

        it('should set end date equal to start date when duration is 0', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', duration: 0 };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.end_date).to.equal('2025-01-01');
        });
      });

      describe('end + duration → start date', () => {
        it('should compute start date from end and duration', () => {
          const data: Record<string, any> = { end_date: '2025-01-05', duration: 5 };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.start_date).to.equal('2025-01-01');
        });

        it('should set start = end when duration is 1', () => {
          const data: Record<string, any> = { end_date: '2025-06-20', duration: 1 };
          applyDateDependencyFieldSync(data, null, makeRule(), cols);
          expect(data.start_date).to.equal('2025-06-20');
        });

        it('should compute start date from UITypes.Duration (seconds) value', () => {
          const data: Record<string, any> = { end_date: '2025-01-05', duration: 5 * 86400 };
          applyDateDependencyFieldSync(data, null, makeRule(), colsSeconds);
          expect(data.start_date).to.equal('2025-01-01');
        });
      });

      describe('oldData fallback', () => {
        it('should read a missing field from oldData by column title', () => {
          const data: Record<string, any> = { start_date: '2025-01-01' };
          applyDateDependencyFieldSync(data, { 'End Date': '2025-01-10' }, makeRule(), cols);
          expect(data.duration).to.equal(10);
        });

        it('should prefer data value over oldData for the same field', () => {
          const data: Record<string, any> = { start_date: '2025-01-01', end_date: '2025-01-05' };
          applyDateDependencyFieldSync(data, { 'End Date': '2025-12-31' }, makeRule(), cols);
          expect(data.duration).to.equal(5);
        });

        it('should use oldData start when only end is in data', () => {
          const data: Record<string, any> = { end_date: '2025-01-10' };
          applyDateDependencyFieldSync(data, { 'Start Date': '2025-01-01' }, makeRule(), cols);
          expect(data.duration).to.equal(10);
        });
      });

      describe('include_weekends = false (business days only)', () => {
        it('should count only business days for start + end → duration', () => {
          // Mon Jan 6 → Fri Jan 10 = 5 business days inclusive
          const data: Record<string, any> = { start_date: '2025-01-06', end_date: '2025-01-10' };
          applyDateDependencyFieldSync(data, null, makeRule({ include_weekends: false }), cols);
          expect(data.duration).to.equal(5);
        });

        it('should skip weekends when computing end from start + duration', () => {
          // Mon Jan 6 + 5 business days = Fri Jan 10
          const data: Record<string, any> = { start_date: '2025-01-06', duration: 5 };
          applyDateDependencyFieldSync(data, null, makeRule({ include_weekends: false }), cols);
          expect(data.end_date).to.equal('2025-01-10');
        });

        it('should skip weekends when computing start from end + duration', () => {
          // Fri Jan 10 − 5 business days = Mon Jan 6
          const data: Record<string, any> = { end_date: '2025-01-10', duration: 5 };
          applyDateDependencyFieldSync(data, null, makeRule({ include_weekends: false }), cols);
          expect(data.start_date).to.equal('2025-01-06');
        });

        it('should count weekend days when include_weekends=true spans a weekend', () => {
          // Fri Jan 10 → Mon Jan 13 = 4 calendar days inclusive
          const data: Record<string, any> = { start_date: '2025-01-10', end_date: '2025-01-13' };
          applyDateDependencyFieldSync(data, null, makeRule({ include_weekends: true }), cols);
          expect(data.duration).to.equal(4);
        });

        it('should count only Mon+Fri when include_weekends=false spans a weekend', () => {
          // Fri Jan 10 → Mon Jan 13 = 2 business days (Fri, Mon)
          const data: Record<string, any> = { start_date: '2025-01-10', end_date: '2025-01-13' };
          applyDateDependencyFieldSync(data, null, makeRule({ include_weekends: false }), cols);
          expect(data.duration).to.equal(2);
        });
      });
    });
  });
}
