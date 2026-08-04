import { FormulaHelper } from './Formula';
import { ColumnHelper } from '../column-helper';
import { SeparatorType } from '../utils';
import UITypes from '~/lib/UITypes';
import { ColumnType } from '~/lib/Api';

describe('FormulaHelper.parseValue', () => {
  const helper = new FormulaHelper();

  it('formats using the configured display_type (Decimal)', () => {
    const col = {
      uidt: UITypes.Formula,
      meta: {
        display_type: UITypes.Decimal,
        display_column_meta: {
          meta: { precision: 2, separator: SeparatorType.NonePeriod },
          custom: {},
        },
      },
    } as unknown as ColumnType;

    const expected = ColumnHelper.parseValue(5, {
      col: {
        uidt: UITypes.Decimal,
        meta: { precision: 2, separator: SeparatorType.NonePeriod },
      } as ColumnType,
    } as any);

    expect(helper.parseValue(5, { col } as any)).toBe(expected);
  });

  it('returns the value unchanged when no display_type is set', () => {
    const col = { uidt: UITypes.Formula, meta: {} } as unknown as ColumnType;

    expect(helper.parseValue('abc', { col } as any)).toBe('abc');
  });
});
