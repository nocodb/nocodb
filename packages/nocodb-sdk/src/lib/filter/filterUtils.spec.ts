import { getPlaceholderNewRow } from '~/lib/filter/filterUtils';
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
