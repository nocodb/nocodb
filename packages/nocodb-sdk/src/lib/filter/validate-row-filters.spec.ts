import {
  RowFilterValidator,
  validateRowFilters,
} from '~/lib/filter/validate-row-filters';
import { ColumnType, FilterType, LinkToAnotherRecordType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { CURRENT_USER_TOKEN } from '~/lib/globals';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);

const mockColumns: ColumnType[] = [
  { id: '1', title: 'Name', uidt: UITypes.SingleLineText },
  { id: '2', title: 'Age', uidt: UITypes.Number },
  { id: '3', title: 'IsActive', uidt: UITypes.Checkbox },
  {
    id: '4',
    title: 'CreatedAt',
    uidt: UITypes.DateTime,
  },
  { id: '5', title: 'CreatedBy', uidt: UITypes.User },
  {
    id: '6',
    title: 'RelatedRecords',
    uidt: UITypes.LinkToAnotherRecord,
    colOptions: {
      fk_related_model_id: 'relatedModel',
    } as LinkToAnotherRecordType,
  },
  { id: '7', title: 'JsonData', uidt: UITypes.JSON },
  { id: '8', title: 'TimeData', uidt: UITypes.Time },
  { id: '9', title: 'DateData', uidt: UITypes.Date },
];

const mockMetas = {
  relatedModel: {
    columns: [
      { id: 'r1', title: 'Primary', pv: true, uidt: UITypes.SingleLineText },
    ],
  },
};

const mockClient = 'pg'; // or 'mysql2'

describe('validateRowFilters', () => {
  it('should return true if no filters are provided', () => {
    const filters: FilterType[] = [];
    const data = { Name: 'Test' };
    const result = validateRowFilters({
      filters,
      data,
      columns: mockColumns,
      client: mockClient,
      metas: mockMetas,
    });
    expect(result).toBe(true);
  });

  // Test cases for basic comparisons (eq, neq, like, nlike)
  describe('Basic comparisons', () => {
    it('should correctly evaluate "eq" for string', () => {
      const filters: FilterType[] = [
        { fk_column_id: '1', comparison_op: 'eq', value: 'Alice' },
      ];
      const data = { Name: 'Alice' };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Name: 'Bob' };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "neq" for string', () => {
      const filters: FilterType[] = [
        { fk_column_id: '1', comparison_op: 'neq', value: 'Alice' },
      ];
      const data = { Name: 'Bob' };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Name: 'Alice' };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "like" for string', () => {
      const filters: FilterType[] = [
        { fk_column_id: '1', comparison_op: 'like', value: 'ali' },
      ];
      const data = { Name: 'Alice' };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Name: 'Bob' };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "nlike" for string', () => {
      const filters: FilterType[] = [
        { fk_column_id: '1', comparison_op: 'nlike', value: 'ali' },
      ];
      const data = { Name: 'Bob' };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Name: 'Alice' };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "eq" for number', () => {
      const filters: FilterType[] = [
        { fk_column_id: '2', comparison_op: 'eq', value: 30 },
      ];
      const data = { Age: 30 };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Age: 25 };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "gt" for number', () => {
      const filters: FilterType[] = [
        { fk_column_id: '2', comparison_op: 'gt', value: 25 },
      ];
      const data = { Age: 30 };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Age: 20 };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "lte" for number', () => {
      const filters: FilterType[] = [
        { fk_column_id: '2', comparison_op: 'lte', value: 30 },
      ];
      const data = { Age: 30 };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Age: 35 };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "checked" for checkbox', () => {
      const filters: FilterType[] = [
        { fk_column_id: '3', comparison_op: 'checked' },
      ];
      const data = { IsActive: true };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { IsActive: false };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "notchecked" for checkbox', () => {
      const filters: FilterType[] = [
        { fk_column_id: '3', comparison_op: 'notchecked' },
      ];
      const data = { IsActive: false };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { IsActive: true };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });
  });

  // Test cases for empty/blank/null checks
  describe('Empty/Blank/Null checks', () => {
    it('should correctly evaluate "empty" for string', () => {
      const filters: FilterType[] = [
        { fk_column_id: '1', comparison_op: 'empty' },
      ];
      const data = { Name: '' };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Name: null };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data3 = { Name: undefined };
      expect(
        validateRowFilters({
          filters,
          data: data3,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data4 = { Name: 'Test' };
      expect(
        validateRowFilters({
          filters,
          data: data4,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "notempty" for string', () => {
      const filters: FilterType[] = [
        { fk_column_id: '1', comparison_op: 'notempty' },
      ];
      const data = { Name: 'Test' };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Name: '' };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "null" for string', () => {
      const filters: FilterType[] = [
        { fk_column_id: '1', comparison_op: 'null' },
      ];
      const data = { Name: null };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Name: 'Test' };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "notnull" for string', () => {
      const filters: FilterType[] = [
        { fk_column_id: '1', comparison_op: 'notnull' },
      ];
      const data = { Name: 'Test' };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { Name: null };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });
  });

  // Test cases for Date/DateTime filters
  describe('Date/DateTime filters', () => {
    const today = dayjs()
      .tz('Etc/UTC')
      .startOf('day')
      .format('YYYY-MM-DD HH:mm:ssZ');
    const todayEnd = dayjs()
      .tz('Etc/UTC')
      .endOf('day')
      .format('YYYY-MM-DD HH:mm:ssZ');
    const yesterday = dayjs()
      .tz('Etc/UTC')
      .subtract(1, 'day')
      .format('YYYY-MM-DD HH:mm:ssZ');
    const tzAsiaKolkata = 'Asia/Kolkata';
    const todayKolkata = dayjs()
      .tz(tzAsiaKolkata)
      .startOf('day')
      .format('YYYY-MM-DD HH:mm:ssZ');
    const todayKolkataEnd = dayjs()
      .tz(tzAsiaKolkata)
      .endOf('day')
      .format('YYYY-MM-DD HH:mm:ssZ');

    it('should correctly evaluate "eq" with "today" sub-op', () => {
      const filters: FilterType[] = [
        { fk_column_id: '4', comparison_op: 'eq', comparison_sub_op: 'today' },
      ];
      const data = { CreatedAt: today };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(true);
      expect(
        validateRowFilters({
          filters,
          data: { CreatedAt: todayEnd },
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(true);
      const data2 = { CreatedAt: yesterday };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(false);
    });

    it('should correctly evaluate "eq" with "today" sub-op for other timezone', () => {
      const filters: FilterType[] = [
        { fk_column_id: '4', comparison_op: 'eq', comparison_sub_op: 'today' },
      ];
      const data = { CreatedAt: todayKolkata };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: tzAsiaKolkata },
        })
      ).toBe(true);
      expect(
        validateRowFilters({
          filters,
          data: { CreatedAt: todayKolkataEnd },
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: tzAsiaKolkata },
        })
      ).toBe(true);
      const data2 = { CreatedAt: yesterday };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(false);
    });

    it('should correctly evaluate "eq" with "yesterday" sub-op', () => {
      const filters: FilterType[] = [
        {
          fk_column_id: '4',
          comparison_op: 'eq',
          comparison_sub_op: 'yesterday',
        },
      ];
      const data = { CreatedAt: yesterday };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(true);
      const data2 = { CreatedAt: today };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(false);
    });

    it('should correctly evaluate "gt" with "daysAgo" sub-op', () => {
      const filters: FilterType[] = [
        {
          fk_column_id: '4',
          comparison_op: 'gt',
          comparison_sub_op: 'daysAgo',
          value: 2,
        },
      ];
      const data = { CreatedAt: yesterday }; // 1 day ago
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(true);
      const data2 = {
        CreatedAt: dayjs()
          .tz('Etc/UTC')
          .subtract(3, 'day')
          .format('YYYY-MM-DD HH:mm:ss'),
      }; // 3 days ago
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(false);
    });

    it('should correctly evaluate "isWithin" with "pastWeek" sub-op', () => {
      const filters: FilterType[] = [
        {
          fk_column_id: '4',
          comparison_op: 'isWithin',
          comparison_sub_op: 'pastWeek',
        },
      ];
      const data = {
        CreatedAt: dayjs()
          .tz('Etc/UTC')
          .subtract(3, 'day')
          .format('YYYY-MM-DD HH:mm:ss'),
      }; // 3 days ago
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(true);
      const data2 = {
        CreatedAt: dayjs()
          .tz('Etc/UTC')
          .subtract(8, 'day')
          .format('YYYY-MM-DD HH:mm:ss'),
      }; // 8 days ago
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(false);
    });

    // Regression: a non-finite (invalid) date value used to reach dayjs.tz(...), whose
    // Intl.DateTimeFormat#formatToParts call throws — "date value is not finite" on
    // Safari, "Invalid time value" in V8. This crashed filter validation (e.g. when a
    // realtime update delivered a malformed date), so the validator must not throw.
    it('does not throw when the row value is an invalid date', () => {
      const filters: FilterType[] = [
        { fk_column_id: '9', comparison_op: 'eq', comparison_sub_op: 'today' },
      ];
      expect(() =>
        validateRowFilters({
          filters,
          data: { DateData: 'abc' },
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).not.toThrow();
    });

    it('does not throw when the filter value is an invalid date', () => {
      const filters: FilterType[] = [
        { fk_column_id: '4', comparison_op: 'eq', value: 'not-a-date' },
      ];
      expect(() =>
        validateRowFilters({
          filters,
          data: { CreatedAt: today },
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).not.toThrow();
    });

    it('should correctly evaluate "isWithin" with "nextNumberOfDays" sub-op', () => {
      const filters: FilterType[] = [
        {
          fk_column_id: '4',
          comparison_op: 'isWithin',
          comparison_sub_op: 'nextNumberOfDays',
          value: 5,
        },
      ];
      const data = {
        CreatedAt: dayjs()
          .tz('Etc/UTC')
          .add(3, 'day')
          .format('YYYY-MM-DD HH:mm:ss'),
      }; // 3 days from now
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(true);
      const data2 = {
        CreatedAt: dayjs()
          .tz('Etc/UTC')
          .add(6, 'day')
          .format('YYYY-MM-DD HH:mm:ss'),
      }; // 6 days from now
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(false);
    });
  });

  // Test cases for User/CreatedBy/LastModifiedBy filters
  describe('User/CreatedBy/LastModifiedBy filters', () => {
    const currentUser = { id: 'user1', email: 'user1@example.com' };

    it('should correctly evaluate "anyof" for single user', () => {
      const filters: FilterType[] = [
        { fk_column_id: '5', comparison_op: 'anyof', value: 'user1' },
      ];
      const data = { CreatedBy: { id: 'user1', email: 'user1@example.com' } };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(true);
      const data2 = { CreatedBy: { id: 'user2', email: 'user2@example.com' } };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(false);
    });

    it('should correctly evaluate "anyof" for multiple users', () => {
      const filters: FilterType[] = [
        { fk_column_id: '5', comparison_op: 'anyof', value: 'user1, user3' },
      ];
      const data = { CreatedBy: [{ id: 'user1' }, { id: 'user2' }] };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(true);
      const data2 = { CreatedBy: [{ id: 'user4' }] };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(false);
    });

    it('should correctly evaluate "anyof" with CURRENT_USER_TOKEN', () => {
      const filters: FilterType[] = [
        {
          fk_column_id: '5',
          comparison_op: 'anyof',
          value: CURRENT_USER_TOKEN,
        },
      ];
      const data = { CreatedBy: { id: 'user1', email: 'user1@example.com' } };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(true);
      const data2 = { CreatedBy: { id: 'user2', email: 'user2@example.com' } };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(false);
    });

    it('should correctly evaluate "allof" for multiple users', () => {
      const filters: FilterType[] = [
        { fk_column_id: '5', comparison_op: 'allof', value: 'user1, user2' },
      ];
      const data = {
        CreatedBy: [{ id: 'user1' }, { id: 'user2' }, { id: 'user3' }],
      };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(true);
      const data2 = { CreatedBy: [{ id: 'user1' }, { id: 'user3' }] };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(false);
    });

    it('should correctly evaluate "empty" for user field', () => {
      const filters: FilterType[] = [
        { fk_column_id: '5', comparison_op: 'empty' },
      ];
      const data = { CreatedBy: [] };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(true);
      const data2 = { CreatedBy: null };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(true);
      const data3 = { CreatedBy: { id: 'user1' } };
      expect(
        validateRowFilters({
          filters,
          data: data3,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { currentUser },
        })
      ).toBe(false);
    });
  });

  // Test cases for LinkToAnotherRecord filters
  describe('LinkToAnotherRecord filters', () => {
    it('should correctly evaluate "eq" for linked record primary value', () => {
      const filters: FilterType[] = [
        { fk_column_id: '6', comparison_op: 'eq', value: 'RecordA' },
      ];
      const data = { RelatedRecords: [{ Primary: 'RecordA' }] };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { RelatedRecords: [{ Primary: 'RecordB' }] };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "like" for linked record primary value', () => {
      const filters: FilterType[] = [
        { fk_column_id: '6', comparison_op: 'like', value: 'record' },
      ];
      const data = { RelatedRecords: [{ Primary: 'RecordA' }] };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { RelatedRecords: [{ Primary: 'SomethingElse' }] };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "anyof" for linked record primary value', () => {
      const filters: FilterType[] = [
        {
          fk_column_id: '6',
          comparison_op: 'anyof',
          value: 'RecordA, RecordC',
        },
      ];
      const data = {
        RelatedRecords: [{ Primary: 'RecordA' }, { Primary: 'RecordB' }],
      };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { RelatedRecords: [{ Primary: 'RecordB' }] };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });

    it('should correctly evaluate "empty" for linked record', () => {
      const filters: FilterType[] = [
        { fk_column_id: '6', comparison_op: 'empty' },
      ];
      const data = { RelatedRecords: [] };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(true);
      const data2 = { RelatedRecords: [{ Primary: 'RecordA' }] };
      expect(
        validateRowFilters({
          filters,
          data: data2,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(false);
    });
  });

  // Edge cases
  describe('Edge cases', () => {
    it('should return null if a date sub-op value is missing', () => {
      const filters: FilterType[] = [
        {
          fk_column_id: '4',
          comparison_op: 'gt',
          comparison_sub_op: 'daysAgo',
          value: null,
        },
      ];
      const data = {
        CreatedAt: dayjs()
          .tz('Etc/UTC')
          .subtract(1, 'day')
          .format('YYYY-MM-DD HH:mm:ss'),
      };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
          options: { timezone: 'Etc/UTC' },
        })
      ).toBe(null);
    });

    it('should handle missing column gracefully', () => {
      const filters: FilterType[] = [
        { fk_column_id: '99', comparison_op: 'eq', value: 'test' },
      ]; // Non-existent column
      const data = { Name: 'Test' };
      expect(
        validateRowFilters({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        })
      ).toBe(null);
    });
  });
});

describe('RowFilterValidator', () => {
  const timestamp = {
    value: 1769756211000, // Thursday, January 29, 2026 10:56:51 PM GMT-08:00
  };
  class RowFilterValidatorTester extends RowFilterValidator {
    override dateNow(): Date {
      return new Date(timestamp.value);
    }
  }

  const validator = new RowFilterValidatorTester();

  describe('validateSync', () => {
    it('will validate date time is today on timezone', () => {
      const testCases = [
        {
          expected: true,
          timestamp: 1769756211000, // Thursday, January 29, 2026 10:56:51 PM GMT-08:00
          data: '2026-01-29',
          timezone: 'America/Los_Angeles',
        },
        {
          expected: true,
          timestamp: 1769839576361, // Friday, January 30, 2026 10:06:16.361 PM
          data: '2026-01-30',
          timezone: 'America/Los_Angeles',
        },
      ];
      for (const testCase of testCases) {
        timestamp.value = testCase.timestamp;

        const filters: (FilterType & { meta?: any })[] = [
          {
            fk_column_id: '9',
            comparison_op: 'eq',
            comparison_sub_op: 'today',
            logical_op: 'and',
            meta: {
              timezone: testCase.timezone,
            },
          },
        ];
        const data = { DateData: testCase.data };
        const result = validator.validateSync({
          filters,
          data,
          columns: mockColumns,
          client: mockClient,
          metas: mockMetas,
        });
        try {
          expect(result).toBe(true);
        } catch (ex) {
          console.error(ex.message, testCase);
          throw ex;
        }
      }
    });
  });
});

// Operators that previously fell through to an undefined result.
describe('validateRowFilters — additional comparison operators', () => {
  const run = (filters: FilterType[], data: any) =>
    validateRowFilters({
      filters,
      data,
      columns: mockColumns,
      client: mockClient,
      metas: mockMetas,
      options: { timezone: 'Etc/UTC' },
    });

  describe('numeric btw / nbtw', () => {
    const btw: FilterType[] = [
      { fk_column_id: '2', comparison_op: 'btw', value: '20,40' },
    ];
    const nbtw: FilterType[] = [
      { fk_column_id: '2', comparison_op: 'nbtw', value: '20,40' },
    ];

    it('btw matches a value inside the inclusive range', () => {
      expect(run(btw, { Age: 30 })).toBe(true);
      expect(run(btw, { Age: 20 })).toBe(true);
      expect(run(btw, { Age: 40 })).toBe(true);
    });

    it('btw rejects a value outside the range', () => {
      expect(run(btw, { Age: 41 })).toBe(false);
      expect(run(btw, { Age: 10 })).toBe(false);
    });

    it('btw and nbtw both reject a missing value', () => {
      expect(run(btw, { Age: null })).toBe(false);
      expect(run(nbtw, { Age: null })).toBe(false);
    });

    it('nbtw matches a value outside the range', () => {
      expect(run(nbtw, { Age: 41 })).toBe(true);
      expect(run(nbtw, { Age: 30 })).toBe(false);
    });
  });

  describe('not (alias of neq)', () => {
    const filters: FilterType[] = [
      { fk_column_id: '1', comparison_op: 'not', value: 'Alice' },
    ];

    it('matches a different value and rejects the same value', () => {
      expect(run(filters, { Name: 'Bob' })).toBe(true);
      expect(run(filters, { Name: 'Alice' })).toBe(false);
    });
  });

  describe('in', () => {
    const filters: FilterType[] = [
      { fk_column_id: '1', comparison_op: 'in', value: 'Alice, Bob' },
    ];

    it('matches membership and rejects non-membership', () => {
      expect(run(filters, { Name: 'Alice' })).toBe(true);
      expect(run(filters, { Name: 'Bob' })).toBe(true);
      expect(run(filters, { Name: 'Carol' })).toBe(false);
    });
  });

  describe('is / isnot', () => {
    it('is null / is notnull', () => {
      expect(
        run([{ fk_column_id: '1', comparison_op: 'is', value: 'null' }], {
          Name: null,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: '1', comparison_op: 'is', value: 'notnull' }], {
          Name: 'x',
        })
      ).toBe(true);
    });

    it('isnot null inverts is null', () => {
      expect(
        run([{ fk_column_id: '1', comparison_op: 'isnot', value: 'null' }], {
          Name: 'x',
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: '1', comparison_op: 'isnot', value: 'null' }], {
          Name: null,
        })
      ).toBe(false);
    });
  });

  describe('date btw / nbtw (exact range)', () => {
    const btw: FilterType[] = [
      {
        fk_column_id: '9',
        comparison_op: 'btw',
        value: '2026-03-01,2026-03-31',
      },
    ];

    it('btw matches a date inside the range and rejects one outside', () => {
      expect(run(btw, { DateData: '2026-03-15' })).toBe(true);
      expect(run(btw, { DateData: '2026-03-01' })).toBe(true);
      expect(run(btw, { DateData: '2026-04-15' })).toBe(false);
    });

    it('nbtw matches a date outside the range', () => {
      const nbtw: FilterType[] = [
        {
          fk_column_id: '9',
          comparison_op: 'nbtw',
          value: '2026-03-01,2026-03-31',
        },
      ];
      expect(run(nbtw, { DateData: '2026-04-15' })).toBe(true);
      expect(run(nbtw, { DateData: '2026-03-15' })).toBe(false);
    });
  });

  describe('date neq with a missing value', () => {
    it('treats a cleared date as "not equal" to a concrete date', () => {
      const filters: FilterType[] = [
        { fk_column_id: '9', comparison_op: 'neq', value: '2026-03-15' },
      ];
      expect(run(filters, { DateData: null })).toBe(true);
      expect(run(filters, { DateData: '2026-03-15' })).toBe(false);
      expect(run(filters, { DateData: '2026-03-16' })).toBe(true);
    });
  });
});

// Computed / relational column types: Lookup (array), Formula (by dataType),
// Rollup, Links/Count (numeric), Attachment (array), Time.
describe('validateRowFilters — column type resolution', () => {
  const relModelId = 'relModel';
  const cols: ColumnType[] = [
    {
      id: 'rel',
      title: 'Rel',
      uidt: UITypes.LinkToAnotherRecord,
      colOptions: { fk_related_model_id: relModelId } as any,
    },
    {
      id: 'lkText',
      title: 'LkText',
      uidt: UITypes.Lookup,
      colOptions: {
        fk_relation_column_id: 'rel',
        fk_lookup_column_id: 'c_text',
      } as any,
    },
    {
      id: 'lkNum',
      title: 'LkNum',
      uidt: UITypes.Lookup,
      colOptions: {
        fk_relation_column_id: 'rel',
        fk_lookup_column_id: 'c_num',
      } as any,
    },
    {
      id: 'lkDate',
      title: 'LkDate',
      uidt: UITypes.Lookup,
      colOptions: {
        fk_relation_column_id: 'rel',
        fk_lookup_column_id: 'c_date',
      } as any,
    },
    {
      id: 'fNum',
      title: 'FNum',
      uidt: UITypes.Formula,
      colOptions: { parsed_tree: { dataType: 'numeric' } } as any,
    },
    {
      id: 'fDate',
      title: 'FDate',
      uidt: UITypes.Formula,
      colOptions: { parsed_tree: { dataType: 'date' } } as any,
    },
    {
      id: 'fStr',
      title: 'FStr',
      uidt: UITypes.Formula,
      colOptions: { parsed_tree: { dataType: 'string' } } as any,
    },
    {
      id: 'lnk',
      title: 'LinkCount',
      uidt: UITypes.Links,
      colOptions: {} as any,
    },
    {
      id: 'rollSum',
      title: 'RollSum',
      uidt: UITypes.Rollup,
      colOptions: {
        rollup_function: 'sum',
        fk_relation_column_id: 'rel',
        fk_rollup_column_id: 'c_num',
      } as any,
    },
    {
      id: 'rollMax',
      title: 'RollMax',
      uidt: UITypes.Rollup,
      colOptions: {
        rollup_function: 'max',
        fk_relation_column_id: 'rel',
        fk_rollup_column_id: 'c_date',
      } as any,
    },
    { id: 'att', title: 'Att', uidt: UITypes.Attachment },
    { id: 'tm', title: 'Tm', uidt: UITypes.Time },
  ];
  const metas = {
    [relModelId]: {
      columns: [
        {
          id: 'c_text',
          title: 'CText',
          uidt: UITypes.SingleLineText,
          pv: true,
        },
        { id: 'c_num', title: 'CNum', uidt: UITypes.Number },
        { id: 'c_date', title: 'CDate', uidt: UITypes.Date },
      ],
    },
  };
  const run = (filters: FilterType[], data: any) =>
    validateRowFilters({
      filters,
      data,
      columns: cols,
      client: mockClient,
      metas,
      options: { timezone: 'Etc/UTC' },
    });

  describe('Lookup (non-user) — array of looked-up values', () => {
    it('text lookup matches via membership / like / anyof', () => {
      expect(
        run([{ fk_column_id: 'lkText', comparison_op: 'eq', value: 'b' }], {
          LkText: ['a', 'b', 'c'],
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'lkText', comparison_op: 'eq', value: 'z' }], {
          LkText: ['a', 'b'],
        })
      ).toBe(false);
      expect(
        run([{ fk_column_id: 'lkText', comparison_op: 'like', value: 'B' }], {
          LkText: ['abc'],
        })
      ).toBe(true);
      expect(
        run(
          [{ fk_column_id: 'lkText', comparison_op: 'anyof', value: 'x,b' }],
          { LkText: ['a', 'b'] }
        )
      ).toBe(true);
    });

    it('empty / notempty count the resolved values', () => {
      expect(
        run([{ fk_column_id: 'lkText', comparison_op: 'empty' }], {
          LkText: [],
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'lkText', comparison_op: 'empty' }], {
          LkText: [null],
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'lkText', comparison_op: 'notempty' }], {
          LkText: ['a'],
        })
      ).toBe(true);
    });

    it('numeric lookup compares element-wise (any value matches)', () => {
      expect(
        run([{ fk_column_id: 'lkNum', comparison_op: 'gt', value: 10 }], {
          LkNum: [5, 20],
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'lkNum', comparison_op: 'gt', value: 100 }], {
          LkNum: [5, 20],
        })
      ).toBe(false);
      expect(
        run([{ fk_column_id: 'lkNum', comparison_op: 'btw', value: '10,30' }], {
          LkNum: [5, 20],
        })
      ).toBe(true);
    });

    it('date lookup compares element-wise', () => {
      expect(
        run(
          [
            {
              fk_column_id: 'lkDate',
              comparison_op: 'btw',
              value: '2026-03-01,2026-03-31',
            },
          ],
          { LkDate: ['2026-01-01', '2026-03-10'] }
        )
      ).toBe(true);
      expect(
        run(
          [
            {
              fk_column_id: 'lkDate',
              comparison_op: 'btw',
              value: '2026-03-01,2026-03-31',
            },
          ],
          { LkDate: ['2026-01-01'] }
        )
      ).toBe(false);
    });
  });

  describe('Formula — routed by parsed_tree.dataType', () => {
    it('numeric formula uses numeric comparison', () => {
      expect(
        run([{ fk_column_id: 'fNum', comparison_op: 'gt', value: 10 }], {
          FNum: 20,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'fNum', comparison_op: 'btw', value: '10,30' }], {
          FNum: 20,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'fNum', comparison_op: 'gt', value: 10 }], {
          FNum: 5,
        })
      ).toBe(false);
    });

    it('date formula uses date comparison', () => {
      expect(
        run(
          [
            {
              fk_column_id: 'fDate',
              comparison_op: 'btw',
              value: '2026-03-01,2026-03-31',
            },
          ],
          { FDate: '2026-03-15' }
        )
      ).toBe(true);
      expect(
        run(
          [{ fk_column_id: 'fDate', comparison_op: 'lt', value: '2026-03-10' }],
          { FDate: '2026-03-05' }
        )
      ).toBe(true);
    });

    it('string formula uses string comparison', () => {
      expect(
        run([{ fk_column_id: 'fStr', comparison_op: 'like', value: 'ell' }], {
          FStr: 'hello',
        })
      ).toBe(true);
    });
  });

  describe('Links / Rollup — numeric, except min/max(date)', () => {
    it('links count compares numerically', () => {
      expect(
        run([{ fk_column_id: 'lnk', comparison_op: 'gt', value: 0 }], {
          LinkCount: 3,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'lnk', comparison_op: 'eq', value: 0 }], {
          LinkCount: 0,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'lnk', comparison_op: 'btw', value: '1,5' }], {
          LinkCount: 3,
        })
      ).toBe(true);
    });

    it('rollup sum is numeric; rollup max(date) is a date', () => {
      expect(
        run([{ fk_column_id: 'rollSum', comparison_op: 'gt', value: 100 }], {
          RollSum: 150,
        })
      ).toBe(true);
      expect(
        run(
          [
            {
              fk_column_id: 'rollMax',
              comparison_op: 'btw',
              value: '2026-03-01,2026-03-31',
            },
          ],
          { RollMax: '2026-03-15' }
        )
      ).toBe(true);
    });
  });

  describe('Attachment / Time', () => {
    it('attachment empty / notempty use array length', () => {
      expect(
        run([{ fk_column_id: 'att', comparison_op: 'empty' }], { Att: [] })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'att', comparison_op: 'notempty' }], {
          Att: [{ title: 'f.png' }],
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'att', comparison_op: 'empty' }], {
          Att: [{ title: 'f.png' }],
        })
      ).toBe(false);
    });

    it('time supports ordered comparisons (not just eq)', () => {
      expect(
        run([{ fk_column_id: 'tm', comparison_op: 'gt', value: '09:00:00' }], {
          Tm: '10:30:00',
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'tm', comparison_op: 'lt', value: '09:00:00' }], {
          Tm: '10:30:00',
        })
      ).toBe(false);
      expect(
        run(
          [
            {
              fk_column_id: 'tm',
              comparison_op: 'btw',
              value: '09:00:00,12:00:00',
            },
          ],
          { Tm: '10:30:00' }
        )
      ).toBe(true);
    });
  });
});

// JSON gets full operator support; Deleted is treated as a boolean (Checkbox).
describe('validateRowFilters — JSON (full support) & Deleted (boolean)', () => {
  const cols: ColumnType[] = [
    { id: 'j', title: 'J', uidt: UITypes.JSON },
    { id: 'del', title: 'Del', uidt: UITypes.Deleted },
  ];
  const run = (filters: FilterType[], data: any) =>
    validateRowFilters({
      filters,
      data,
      columns: cols,
      client: mockClient,
      metas: {},
    });

  describe('JSON', () => {
    it('eq / neq deep-compare (object or string cell)', () => {
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'eq', value: '{"a":1}' }], {
          J: { a: 1 },
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'eq', value: '{"a":1}' }], {
          J: '{"a":1}',
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'eq', value: '{"a":1}' }], {
          J: { a: 2 },
        })
      ).toBe(false);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'neq', value: '{"a":1}' }], {
          J: { a: 2 },
        })
      ).toBe(true);
      // a null cell is "not equal" to a concrete value
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'neq', value: '{"a":1}' }], {
          J: null,
        })
      ).toBe(true);
    });

    it('like / nlike substring-match the serialized JSON', () => {
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'like', value: 'hello' }], {
          J: { name: 'hello world' },
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'like', value: 'xyz' }], {
          J: { name: 'hello' },
        })
      ).toBe(false);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'nlike', value: 'xyz' }], {
          J: { name: 'hello' },
        })
      ).toBe(true);
    });

    it('blank/empty treat null and {}/[] as blank', () => {
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'blank' }], { J: null })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'blank' }], { J: {} })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'blank' }], { J: [] })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'blank' }], { J: { a: 1 } })
      ).toBe(false);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'notempty' }], { J: { a: 1 } })
      ).toBe(true);
    });

    it('is / isnot null|notnull', () => {
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'is', value: 'null' }], {
          J: {},
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'is', value: 'notnull' }], {
          J: { a: 1 },
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'isnot', value: 'null' }], {
          J: { a: 1 },
        })
      ).toBe(true);
    });

    it('ordered/membership ops are not meaningful → no match', () => {
      expect(
        run([{ fk_column_id: 'j', comparison_op: 'gt', value: 1 }], {
          J: { a: 5 },
        })
      ).toBe(false);
    });
  });

  describe('Deleted (boolean)', () => {
    it('checked / notchecked / eq behave as a checkbox', () => {
      expect(
        run([{ fk_column_id: 'del', comparison_op: 'checked' }], { Del: true })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'del', comparison_op: 'checked' }], { Del: false })
      ).toBe(false);
      expect(
        run([{ fk_column_id: 'del', comparison_op: 'notchecked' }], {
          Del: false,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'del', comparison_op: 'notchecked' }], {
          Del: null,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'del', comparison_op: 'eq', value: true }], {
          Del: true,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'del', comparison_op: 'eq', value: true }], {
          Del: false,
        })
      ).toBe(false);
    });
  });
});

// Active coverage for the branches kept through the refactor (previously only
// exercised by the skipped legacy blocks): User, LTAR, Formula→boolean,
// lookup→user, and nested-lookup type resolution.
describe('validateRowFilters — User / LTAR / nested resolution', () => {
  const currentUser = { id: 'user1', email: 'user1@example.com' };
  const userRun = (filters: FilterType[], data: any) =>
    validateRowFilters({
      filters,
      data,
      columns: mockColumns,
      client: mockClient,
      metas: mockMetas,
      options: { currentUser },
    });

  describe('User / CreatedBy / LastModifiedBy', () => {
    it('anyof / allof / empty / CURRENT_USER_TOKEN', () => {
      expect(
        userRun(
          [{ fk_column_id: '5', comparison_op: 'anyof', value: 'user1' }],
          {
            CreatedBy: { id: 'user1' },
          }
        )
      ).toBe(true);
      expect(
        userRun(
          [{ fk_column_id: '5', comparison_op: 'anyof', value: 'user1' }],
          {
            CreatedBy: { id: 'user2' },
          }
        )
      ).toBe(false);
      expect(
        userRun(
          [{ fk_column_id: '5', comparison_op: 'allof', value: 'user1,user2' }],
          { CreatedBy: [{ id: 'user1' }, { id: 'user2' }, { id: 'user3' }] }
        )
      ).toBe(true);
      expect(
        userRun([{ fk_column_id: '5', comparison_op: 'empty' }], {
          CreatedBy: [],
        })
      ).toBe(true);
      expect(
        userRun([{ fk_column_id: '5', comparison_op: 'notempty' }], {
          CreatedBy: { id: 'user1' },
        })
      ).toBe(true);
      // CURRENT_USER_TOKEN resolves to options.currentUser.id
      expect(
        userRun(
          [
            {
              fk_column_id: '5',
              comparison_op: 'anyof',
              value: CURRENT_USER_TOKEN,
            },
          ],
          { CreatedBy: { id: 'user1' } }
        )
      ).toBe(true);
    });
  });

  describe('LinkToAnotherRecord (matches related pv value)', () => {
    it('eq / like / anyof / empty', () => {
      expect(
        userRun(
          [{ fk_column_id: '6', comparison_op: 'eq', value: 'RecordA' }],
          { RelatedRecords: [{ Primary: 'RecordA' }] }
        )
      ).toBe(true);
      expect(
        userRun(
          [{ fk_column_id: '6', comparison_op: 'eq', value: 'RecordA' }],
          { RelatedRecords: [{ Primary: 'RecordB' }] }
        )
      ).toBe(false);
      expect(
        userRun([{ fk_column_id: '6', comparison_op: 'like', value: 'rec' }], {
          RelatedRecords: [{ Primary: 'RecordA' }],
        })
      ).toBe(true);
      expect(
        userRun(
          [
            {
              fk_column_id: '6',
              comparison_op: 'anyof',
              value: 'RecordA,RecordC',
            },
          ],
          { RelatedRecords: [{ Primary: 'RecordA' }, { Primary: 'RecordB' }] }
        )
      ).toBe(true);
      expect(
        userRun([{ fk_column_id: '6', comparison_op: 'empty' }], {
          RelatedRecords: [],
        })
      ).toBe(true);
    });
  });

  describe('Formula→boolean, lookup→user, nested lookup', () => {
    const cols: ColumnType[] = [
      {
        id: 'rel',
        title: 'Rel',
        uidt: UITypes.LinkToAnotherRecord,
        colOptions: { fk_related_model_id: 'modelB' } as any,
      },
      {
        id: 'fBool',
        title: 'FBool',
        uidt: UITypes.Formula,
        colOptions: { parsed_tree: { dataType: 'boolean' } } as any,
      },
      {
        id: 'lkUser',
        title: 'LkUser',
        uidt: UITypes.Lookup,
        colOptions: {
          fk_relation_column_id: 'rel',
          fk_lookup_column_id: 'u1',
        } as any,
      },
      {
        id: 'lkNested',
        title: 'LkNested',
        uidt: UITypes.Lookup,
        colOptions: {
          fk_relation_column_id: 'rel',
          fk_lookup_column_id: 'innerLookup',
        } as any,
      },
    ];
    const metas = {
      modelB: {
        columns: [
          { id: 'u1', title: 'Owner', uidt: UITypes.User, pv: true },
          {
            id: 'innerLookup',
            title: 'Inner',
            uidt: UITypes.Lookup,
            colOptions: {
              fk_relation_column_id: 'relC',
              fk_lookup_column_id: 't1',
            },
          },
          {
            id: 'relC',
            title: 'RelC',
            uidt: UITypes.LinkToAnotherRecord,
            colOptions: { fk_related_model_id: 'modelC' },
          },
        ],
      },
      modelC: {
        columns: [
          { id: 't1', title: 'T', uidt: UITypes.SingleLineText, pv: true },
        ],
      },
    };
    const run = (filters: FilterType[], data: any) =>
      validateRowFilters({
        filters,
        data,
        columns: cols,
        client: mockClient,
        metas,
        options: { currentUser },
      });

    it('boolean formula behaves like a checkbox', () => {
      expect(
        run([{ fk_column_id: 'fBool', comparison_op: 'checked' }], {
          FBool: true,
        })
      ).toBe(true);
      expect(
        run([{ fk_column_id: 'fBool', comparison_op: 'notchecked' }], {
          FBool: false,
        })
      ).toBe(true);
    });

    it('lookup→user routes to the user branch (anyof on resolved ids)', () => {
      expect(
        run(
          [{ fk_column_id: 'lkUser', comparison_op: 'anyof', value: 'user1' }],
          {
            LkUser: [{ id: 'user1' }],
          }
        )
      ).toBe(true);
      expect(
        run(
          [{ fk_column_id: 'lkUser', comparison_op: 'anyof', value: 'user9' }],
          {
            LkUser: [{ id: 'user1' }],
          }
        )
      ).toBe(false);
    });

    it('nested lookup resolves to the leaf (text) type', () => {
      expect(
        run(
          [{ fk_column_id: 'lkNested', comparison_op: 'eq', value: 'hello' }],
          {
            LkNested: ['hello', 'world'],
          }
        )
      ).toBe(true);
      expect(
        run(
          [{ fk_column_id: 'lkNested', comparison_op: 'eq', value: 'nope' }],
          {
            LkNested: ['hello'],
          }
        )
      ).toBe(false);
    });
  });
});
