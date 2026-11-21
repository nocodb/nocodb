import {
  compileStructuredFilter,
  StructuredFilterError,
} from './structuredFilter';
import type { FilterColumn, StructuredFilter } from './structuredFilter';
import { NcApiVersion } from '~/lib/enums';
import { extractFilterFromXwhere } from '~/lib/filterHelpers';
import UITypes from '~/lib/UITypes';
import type { ColumnType } from '~/lib/Api';

const COLUMNS: FilterColumn[] = [
  { id: 'c_due', title: 'Due Date', uidt: UITypes.Date },
  { id: 'c_amt', title: 'Amount', uidt: UITypes.Number },
  { id: 'c_title', title: 'Title', uidt: UITypes.SingleLineText },
  { id: 'c_tags', title: 'Tags', uidt: UITypes.MultiSelect },
  { id: 'c_done', title: 'Done', uidt: UITypes.Checkbox },
];

const compile = (filter: StructuredFilter, columns = COLUMNS) =>
  compileStructuredFilter(columns, filter);

/** Parses `where` the way the v3 data API does; throws on anything it rejects. */
const parseV3 = (where: string, columns = COLUMNS) => {
  const aliasColObjMap: Record<string, ColumnType> = {};
  for (const c of columns) aliasColObjMap[c.title!] = c as ColumnType;
  return extractFilterFromXwhere(
    { api_version: NcApiVersion.V3, timezone: 'UTC' },
    where,
    aliasColObjMap,
    true
  ).filters!;
};

describe('compileStructuredFilter', () => {
  it('compiles the v3 shape: conditions and nested groups', () => {
    expect(
      compile({
        group_operator: 'AND',
        filters: [
          { field: 'Title', operator: 'eq', value: 'Ada' },
          {
            group_operator: 'OR',
            filters: [
              { field: 'Amount', operator: 'btw', value: [1, 5] },
              { field: 'Done', operator: 'checked' },
            ],
          },
        ],
      })
    ).toBe('(Title,eq,Ada)~and((Amount,btw,1,5)~or(Done,checked))');
  });

  it('emits where strings the v3 parser accepts', () => {
    const filters: StructuredFilter[] = [
      {
        field: 'Due Date',
        operator: 'gt',
        sub_operator: 'exactDate',
        value: '2026-01-01',
      },
      { field: 'Due Date', operator: 'eq', sub_operator: 'today' },
      {
        field: 'Due Date',
        operator: 'lt',
        sub_operator: 'daysAgo',
        value: 3,
      },
      {
        field: 'Due Date',
        operator: 'isWithin',
        sub_operator: 'thisCalendarMonth',
      },
      {
        field: 'Due Date',
        operator: 'isWithin',
        sub_operator: 'dateRange',
        value: ['2026-01-01', '2026-01-31'],
      },
      { field: 'Due Date', operator: 'blank' },
      { field: 'Amount', operator: 'btw', value: [1, 5] },
      { field: 'Title', operator: 'in', value: ['a', 'b, c'] },
      { field: 'Tags', operator: 'anyof', value: ['x', 'y'] },
      { field: 'Done', operator: 'checked' },
      { field: 'Done', operator: 'eq', value: true },
    ];
    for (const filter of filters) {
      expect(() => parseV3(compile(filter))).not.toThrow();
    }
  });

  it('round-trips field names and values with spaces and grammar characters', () => {
    const names = [
      'Due Date',
      'Name, full',
      "O'Brien",
      'a(b)',
      ' padded ',
      'Ünïcødé 名前 🚀',
      'eq',
      'null',
      '~not',
      'x~and y',
    ];
    const values = [
      'hello world',
      'a, b',
      "O'Brien",
      '(x)',
      ' lead',
      'trail ',
      'eq',
      'blank',
      '~and',
      '100%',
      'null',
      'NULL',
      '',
      'multi\nline',
      '名前 🚀',
    ];
    for (const title of names) {
      const columns = [{ id: 'c1', title, uidt: UITypes.SingleLineText }];
      for (const value of values) {
        const [parsed] = parseV3(
          compile({ field: title, operator: 'eq', value }, columns),
          columns
        );
        expect([parsed.fk_column_id, parsed.value ?? '']).toEqual([
          'c1',
          value,
        ]);
      }
    }
  });

  it('accepts a field id or an object carrying it', () => {
    expect(compile({ field: 'c_amt', operator: 'gt', value: 1 })).toBe(
      '(Amount,gt,1)'
    );
    expect(compile({ field: { id: 'c_amt' }, operator: 'gt', value: 1 })).toBe(
      '(Amount,gt,1)'
    );
  });

  it('refuses what v3 would reject or misread', () => {
    const refuse = (filter: unknown, message: string) =>
      expect(() => compileStructuredFilter(COLUMNS, filter)).toThrow(
        expect.objectContaining({
          constructor: StructuredFilterError,
          message: expect.stringContaining(message),
        })
      );
    refuse(
      { field: 'Due Date', operator: 'gt', value: '2026-01-01' },
      'needs a sub_operator'
    );
    refuse(
      {
        field: 'Due Date',
        operator: 'btw',
        value: ['2026-01-01', '2026-02-01'],
      },
      'not supported on the Date field'
    );
    refuse(
      { field: 'Nope', operator: 'eq', value: 1 },
      "Unknown filter field 'Nope'"
    );
    refuse(
      { field: 'Title', operator: 'gtt', value: 1 },
      "Unknown filter operator 'gtt'"
    );
    refuse(
      { field: 'Amount', operator: 'btw', value: [1] },
      'exactly two values'
    );
    refuse(
      { field: 'Done', operator: 'checked', value: true },
      'takes no value'
    );
    refuse(
      {
        group_operator: 'XOR',
        filters: [{ field: 'Done', operator: 'checked' }],
      },
      'must be "AND" or "OR"'
    );
    refuse({ group_operator: 'AND', filters: [] }, 'at least one condition');
  });
});
