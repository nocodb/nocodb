import { ColumnType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';
import { isRowDataUnchanged } from './row-data-unchanged';

const options = (...opts: Array<[string, string, string?]>) => ({
  options: opts.map(([id, title, color]) => ({ id, title, color })),
});

const select = (
  opts: ReturnType<typeof options>,
  extra: Partial<ColumnType> = {}
): ColumnType => ({
  title: 'Status',
  column_name: 'status',
  uidt: UITypes.SingleSelect,
  dt: 'text',
  colOptions: opts,
  ...extra,
});

const text = (extra: Partial<ColumnType> = {}): ColumnType => ({
  title: 'Name',
  column_name: 'name',
  uidt: UITypes.SingleLineText,
  dt: 'character varying',
  dtxp: '255',
  ...extra,
});

describe('isRowDataUnchanged', () => {
  const base = options(['o1', 'Open', '#fff'], ['o2', 'Done', '#000']);

  it('is true for an added or recoloured select option', () => {
    expect(
      isRowDataUnchanged(
        select(base),
        select(
          options(
            ['o1', 'Open', '#fff'],
            ['o2', 'Done', '#000'],
            ['o3', 'Blocked']
          )
        )
      )
    ).toBe(true);
    expect(
      isRowDataUnchanged(
        select(base),
        select(options(['o1', 'Open', '#f00'], ['o2', 'Done', '#000']))
      )
    ).toBe(true);
  });

  it('is false for a renamed or removed select option', () => {
    expect(
      isRowDataUnchanged(
        select(base),
        select(options(['o1', 'Todo', '#fff'], ['o2', 'Done', '#000']))
      )
    ).toBe(false);
    expect(
      isRowDataUnchanged(select(base), select(options(['o1', 'Open', '#fff'])))
    ).toBe(false);
  });

  it('is false for a title, dtxp or type change and for virtual columns', () => {
    expect(isRowDataUnchanged(text(), text({ title: 'Full name' }))).toBe(
      false
    );
    expect(isRowDataUnchanged(text(), text({ dtxp: '100' }))).toBe(false);
    expect(isRowDataUnchanged(text(), text({ uidt: UITypes.LongText }))).toBe(
      false
    );
    const formula: ColumnType = {
      title: 'Calc',
      column_name: 'calc',
      uidt: UITypes.Formula,
      colOptions: { formula: '1' },
    };
    expect(isRowDataUnchanged(formula, { ...formula })).toBe(false);
  });

  it('is true for a default value, description or display-only meta change', () => {
    expect(isRowDataUnchanged(text(), text({ cdf: 'n/a' }))).toBe(true);
    expect(
      isRowDataUnchanged(text(), text({ description: 'Customer name' }))
    ).toBe(true);
    expect(
      isRowDataUnchanged(
        text({ uidt: UITypes.Number, meta: {} }),
        text({ uidt: UITypes.Number, meta: { isLocaleString: true } })
      )
    ).toBe(true);
  });

  it('is false for a meta change that can rewrite cells', () => {
    expect(
      isRowDataUnchanged(
        text({ uidt: UITypes.LongText, meta: {} }),
        text({ uidt: UITypes.LongText, meta: { ai: true } })
      )
    ).toBe(false);
    expect(
      isRowDataUnchanged(
        text({ uidt: UITypes.Date, meta: { date_format: 'YYYY-MM-DD' } }),
        text({ uidt: UITypes.Date, meta: { date_format: 'DD-MM-YYYY' } })
      )
    ).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(isRowDataUnchanged(undefined, text())).toBe(false);
  });
});
