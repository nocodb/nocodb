import { validateRowFilters } from './validate-row-filters';
import { ColumnType, FilterType, LinkToAnotherRecordType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { CURRENT_USER_TOKEN } from '~/lib';

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
  // FIXME: not reviewed
  describe.skip('Basic comparisons', () => {
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
  // FIXME: not reviewed
  describe.skip('Empty/Blank/Null checks', () => {
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
  // FIXME: not reviewed
  describe.skip('User/CreatedBy/LastModifiedBy filters', () => {
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
  // FIXME: not reviewed
  describe.skip('LinkToAnotherRecord filters', () => {
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
  // FIXME: not reviewed
  describe.skip('Edge cases', () => {
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
