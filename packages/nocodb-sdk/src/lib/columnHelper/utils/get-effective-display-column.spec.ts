import { getEffectiveDisplayColumn } from './get-effective-display-column';
import UITypes from '~/lib/UITypes';
import { ColumnType } from '~/lib/Api';

describe('getEffectiveDisplayColumn', () => {
  it('returns the base column unchanged when no display_type is set', () => {
    const base = {
      id: 'c1',
      uidt: UITypes.Number,
      meta: { precision: 2 },
    } as ColumnType;

    expect(getEffectiveDisplayColumn({}, base)).toBe(base);
    expect(getEffectiveDisplayColumn(null, base)).toBe(base);
    expect(getEffectiveDisplayColumn(undefined, base)).toBe(base);
    expect(getEffectiveDisplayColumn({ display_type: null }, base)).toBe(base);
  });

  it('overrides uidt and meta from display config while keeping other base props', () => {
    const base = {
      id: 'c1',
      uidt: UITypes.Number,
      title: 'Amount',
      colOptions: { foo: 'bar' },
      meta: { precision: 0 },
    } as unknown as ColumnType;

    const result = getEffectiveDisplayColumn(
      {
        display_type: UITypes.Currency,
        display_column_meta: {
          meta: { currency_code: 'USD', currency_locale: 'en-US', precision: 2 },
          custom: {},
        },
      },
      base
    );

    expect(result.uidt).toBe(UITypes.Currency);
    // base props retained
    expect(result.id).toBe('c1');
    expect(result.title).toBe('Amount');
    expect((result as any).colOptions.foo).toBe('bar');
    // meta replaced by display config's meta
    expect((result.meta as any).currency_code).toBe('USD');
    expect((result.meta as any).precision).toBe(2);
    // original base object not mutated
    expect((base.meta as any).precision).toBe(0);
  });

  it('parses a stringified display_column_meta', () => {
    const result = getEffectiveDisplayColumn(
      {
        display_type: UITypes.Decimal,
        display_column_meta: JSON.stringify({ meta: { precision: 3 } }),
      },
      {}
    );

    expect(result.uidt).toBe(UITypes.Decimal);
    expect((result.meta as any).precision).toBe(3);
  });

  it('defaults the base column to an empty object (Formula-style usage)', () => {
    const result = getEffectiveDisplayColumn({
      display_type: UITypes.Percent,
      display_column_meta: { meta: { precision: 1 }, custom: {} },
    });

    expect(result.uidt).toBe(UITypes.Percent);
    expect((result.meta as any).precision).toBe(1);
  });
});
