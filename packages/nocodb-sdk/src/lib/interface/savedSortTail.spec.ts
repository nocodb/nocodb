import { normalizeInterfaceSortDirection, savedSortTailStart } from './index';

describe('savedSortTailStart', () => {
  const date = 'c_date';
  const salary = 'c_salary';

  it('finds the saved list as the tail, after leading viewer keys', () => {
    const saved = [
      { fk_column_id: date, direction: 'asc' },
      { fk_column_id: salary, direction: 'desc' },
    ];

    expect(savedSortTailStart(saved, saved)).toBe(0);
    expect(
      savedSortTailStart(
        [{ fk_column_id: date, direction: 'desc' }, ...saved],
        saved
      )
    ).toBe(1);
  });

  it('treats a missing direction and any casing of asc as asc', () => {
    const saved = [
      { fk_column_id: date },
      { fk_column_id: salary, direction: 'desc' },
    ];

    expect(
      savedSortTailStart(
        [
          { fk_column_id: date, direction: 'ASC' },
          { fk_column_id: salary, direction: 'DESC' },
        ],
        saved
      )
    ).toBe(0);
    expect(
      savedSortTailStart(
        [
          { fk_column_id: date, direction: 'asc' },
          { fk_column_id: salary, direction: 'desc' },
        ],
        [
          { fk_column_id: date, direction: 'ASC' },
          { fk_column_id: salary, direction: 'desc' },
        ]
      )
    ).toBe(0);
  });

  it('refuses a subset, a flipped direction, a reorder or an empty saved list', () => {
    const saved = [
      { fk_column_id: date, direction: 'asc' },
      { fk_column_id: salary, direction: 'desc' },
    ];

    expect(savedSortTailStart([saved[1]], saved)).toBe(-1);
    expect(
      savedSortTailStart(
        [saved[0], { fk_column_id: salary, direction: 'asc' }],
        saved
      )
    ).toBe(-1);
    expect(savedSortTailStart([saved[1], saved[0]], saved)).toBe(-1);
    expect(savedSortTailStart(saved, [])).toBe(-1);
  });

  it('normalizes directions', () => {
    expect(normalizeInterfaceSortDirection('DESC')).toBe('desc');
    expect(normalizeInterfaceSortDirection('ASC')).toBe('asc');
    expect(normalizeInterfaceSortDirection(undefined)).toBe('asc');
    expect(normalizeInterfaceSortDirection('count-desc')).toBe('asc');
  });
});
