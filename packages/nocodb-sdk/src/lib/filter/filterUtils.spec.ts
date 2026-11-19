import {
  comparisonSubOpList,
  getPlaceholderNewRow,
} from '~/lib/filter/filterUtils';
import { formulaDateUidt } from '~/lib/formula/dateOnlyFormula';
import { FormulaDataTypes, JSEPNode } from '~/lib/formula/enums';
import { ColumnType, FilterType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';

const columns: ColumnType[] = [
  { id: 'c1', title: 'Project', uidt: UITypes.SingleLineText },
  { id: 'c2', title: 'Code', uidt: UITypes.Number },
  { id: 'c3', title: 'Status', uidt: UITypes.SingleSelect },
  { id: 'c4', title: 'Done', uidt: UITypes.Checkbox },
];

const eq = (
  fk_column_id: string,
  value: any,
  extra: Partial<FilterType> = {}
): FilterType => ({
  fk_column_id,
  comparison_op: 'eq',
  logical_op: 'and',
  value,
  ...extra,
});

describe('getPlaceholderNewRow', () => {
  it('prefills from enabled filters', () => {
    expect(
      getPlaceholderNewRow(
        [eq('c1', 'Olivia'), eq('c2', 94513, { enabled: true })],
        columns
      )
    ).toEqual({ Project: 'Olivia', Code: 94513 });
  });

  it('ignores disabled filters (boolean false and int 0)', () => {
    expect(
      getPlaceholderNewRow(
        [
          eq('c1', 'Olivia', { enabled: false }),
          eq('c2', 94513, { enabled: 0 }),
        ],
        columns
      )
    ).toEqual({});
  });

  it('keeps enabled filters when mixed with disabled ones', () => {
    expect(
      getPlaceholderNewRow(
        [
          eq('c1', 'Olivia', { enabled: false }),
          eq('c3', 'Published', { enabled: true }),
          { fk_column_id: 'c4', comparison_op: 'checked', logical_op: 'and' },
          eq('c2', 94513, { enabled: 0 }),
        ],
        columns
      )
    ).toEqual({ Status: 'Published', Done: true });
  });

  it('does not let a disabled "or" filter suppress the prefill', () => {
    expect(
      getPlaceholderNewRow(
        [
          eq('c1', 'Olivia'),
          eq('c3', 'Draft', { logical_op: 'or', enabled: false }),
        ],
        columns
      )
    ).toEqual({ Project: 'Olivia' });
  });

  it('still bails out on an enabled "or" filter', () => {
    expect(
      getPlaceholderNewRow(
        [eq('c1', 'Olivia'), eq('c3', 'Draft', { logical_op: 'or' })],
        columns
      )
    ).toEqual({});
  });

  it('skips the children of a disabled group', () => {
    // `allFilters` is flattened, so a disabled group and its children arrive as
    // siblings — only the group row carries `enabled: false`.
    expect(
      getPlaceholderNewRow(
        [
          { id: 'g1', is_group: true, logical_op: 'and', enabled: false },
          eq('c1', 'Olivia', { id: 'f1', fk_parent_id: 'g1' }),
          eq('c2', 94513, { id: 'f2' }),
        ],
        columns
      )
    ).toEqual({ Code: 94513 });
  });

  it('skips grandchildren of a disabled group', () => {
    expect(
      getPlaceholderNewRow(
        [
          { id: 'g1', is_group: true, logical_op: 'and', enabled: false },
          { id: 'g2', is_group: true, logical_op: 'and', fk_parent_id: 'g1' },
          eq('c1', 'Olivia', { id: 'f1', fk_parent_id: 'g2' }),
          eq('c2', 94513, { id: 'f2' }),
        ],
        columns
      )
    ).toEqual({ Code: 94513 });
  });

  it('keeps the children of an enabled group', () => {
    expect(
      getPlaceholderNewRow(
        [
          { id: 'g1', is_group: true, logical_op: 'and' },
          eq('c1', 'Olivia', { id: 'f1', fk_parent_id: 'g1' }),
        ],
        columns
      )
    ).toEqual({ Project: 'Olivia' });
  });

  it('does not let an "or" child of a disabled group suppress the prefill', () => {
    expect(
      getPlaceholderNewRow(
        [
          { id: 'g1', is_group: true, logical_op: 'and', enabled: false },
          eq('c3', 'Draft', { id: 'f1', fk_parent_id: 'g1', logical_op: 'or' }),
          eq('c1', 'Olivia', { id: 'f2' }),
        ],
        columns
      )
    ).toEqual({ Project: 'Olivia' });
  });

  it('skips group rows', () => {
    expect(
      getPlaceholderNewRow(
        [
          {
            is_group: true,
            logical_op: 'and',
            children: [eq('c1', 'Olivia')],
          } as FilterType,
          eq('c2', 94513),
        ],
        columns
      )
    ).toEqual({ Code: 94513 });
  });
});

describe('formulaDateUidt', () => {
  const date = {
    type: JSEPNode.IDENTIFIER,
    name: 'cDate',
    referencedColumn: { id: 'cDate', uidt: UITypes.Date },
  };
  const dateTime = {
    type: JSEPNode.IDENTIFIER,
    name: 'cDt',
    referencedColumn: { id: 'cDt', uidt: UITypes.DateTime },
  };
  const num = {
    type: JSEPNode.IDENTIFIER,
    referencedColumn: { id: 'cNum', uidt: UITypes.Number },
  };
  const lit = (value: string | number) => ({
    type: JSEPNode.LITERAL,
    value,
    raw: `${value}`,
  });
  const call = (name: string, ...args: any[]) =>
    ({
      type: JSEPNode.CALL_EXP,
      callee: { type: JSEPNode.IDENTIFIER, name },
      arguments: args,
      dataType: FormulaDataTypes.DATE,
    } as any);

  it('a date-only result filters as a Date', () => {
    for (const tree of [
      call('DATEADD', date, lit(7), lit('day')),
      call('DATEADD', date, lit(-1), lit('month')),
      // DATEADD lowercases its unit
      call('DATEADD', date, lit(2), lit('Week')),
      call('DATEADD', date, { ...num, name: 'cNum' }, lit('day')),
      call('TODAY'),
      call('WORKDAY', date, lit(3)),
      call('IF', lit(1), call('TODAY'), call('BLANK')),
      // through a date-only formula, marked by validation
      call(
        'DATEADD',
        {
          ...date,
          name: 'cFormula',
          referencedColumn: { ...date.referencedColumn, dateOnly: true },
        },
        lit(1),
        lit('day')
      ),
    ]) {
      expect(formulaDateUidt(tree)).toBe(UITypes.Date);
    }
  });

  it('a result that can carry a time stays a DateTime', () => {
    for (const tree of [
      call('NOW'),
      call('DATEADD', date, lit(3), lit('hour')),
      call('DATEADD', date, lit(1.5), lit('day')),
      call('DATEADD', dateTime, lit(1), lit('day')),
      // another formula's referencedColumn names its source, not itself
      call('DATEADD', { ...date, name: 'cFormula' }, lit(1), lit('day')),
      // a formula over a Number, e.g. MAX({Num}, 0.5), can be fractional
      call('DATEADD', date, { ...num, name: 'cFormula' }, lit('day')),
      call('IF', lit(1), call('TODAY'), call('NOW')),
    ]) {
      expect(formulaDateUidt(tree)).toBe(UITypes.DateTime);
    }
    expect(
      formulaDateUidt({ ...call('TODAY'), dataType: FormulaDataTypes.STRING })
    ).toBeUndefined();
  });
});

describe('comparisonSubOpList isWithin', () => {
  const values = (format?: string) =>
    comparisonSubOpList('isWithin', format).map((o) => o.value);

  it('hides calendar weeks on a month-format field', () => {
    expect(values('YYYY-MM-DD')).toContain('thisCalendarWeek');
    expect(values('YYYY-MM')).not.toContain('thisCalendarWeek');
    expect(values('YYYY-MM')).not.toContain('lastCalendarWeek');
    expect(values('YYYY-MM')).toContain('thisCalendarMonth');
  });
});
