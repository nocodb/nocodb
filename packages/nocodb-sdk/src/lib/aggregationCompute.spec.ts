import {
  AttachmentAggregations,
  BooleanAggregations,
  CommonAggregations,
  DateAggregations,
  NumericalAggregations,
} from '~/lib/aggregationHelper';
import {
  computeAggregation,
  getAggregationCategory,
} from '~/lib/aggregationCompute';
import UITypes from '~/lib/UITypes';
import { FormulaDataTypes } from '~/lib/formula/enums';
import type { ColumnType } from '~/lib/Api';

const col = (uidt: UITypes, extra: Partial<ColumnType> = {}): ColumnType =>
  ({ uidt, ...extra } as ColumnType);

const numberCol = col(UITypes.Number);
const decimalCol = col(UITypes.Decimal);
const ratingCol = col(UITypes.Rating);
const dateCol = col(UITypes.Date);
const dateTimeCol = col(UITypes.DateTime);
const checkboxCol = col(UITypes.Checkbox);
const textCol = col(UITypes.SingleLineText);
const jsonCol = col(UITypes.JSON);
const attachmentCol = col(UITypes.Attachment);

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('aggregationCompute', () => {
  describe('getAggregationCategory', () => {
    it('classifies each aggregation type', () => {
      expect(getAggregationCategory(CommonAggregations.Count)).toBe('common');
      expect(getAggregationCategory(CommonAggregations.None)).toBe('common');
      expect(getAggregationCategory(NumericalAggregations.Sum)).toBe(
        'numerical'
      );
      expect(getAggregationCategory(BooleanAggregations.Checked)).toBe(
        'boolean'
      );
      expect(getAggregationCategory(DateAggregations.EarliestDate)).toBe(
        'date'
      );
      expect(
        getAggregationCategory(AttachmentAggregations.AttachmentSize)
      ).toBe('attachment');
      expect(getAggregationCategory('not-a-real-agg')).toBe('unknown');
    });
  });

  describe('None / unknown', () => {
    it('returns null for None', () => {
      expect(
        computeAggregation({
          aggregation: CommonAggregations.None,
          values: [1, 2, 3],
          column: numberCol,
        })
      ).toBeNull();
    });

    it('returns null for unknown aggregation', () => {
      expect(
        computeAggregation({
          aggregation: 'mystery',
          values: [1, 2, 3],
          column: numberCol,
        })
      ).toBeNull();
    });

    it('returns null for empty aggregation string', () => {
      expect(
        computeAggregation({
          aggregation: '',
          values: [1, 2, 3],
          column: numberCol,
        })
      ).toBeNull();
    });
  });

  describe('CommonAggregations', () => {
    describe('Count', () => {
      it('counts every row including nulls/empties', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.Count,
            values: [1, null, 'a', '', undefined, 0],
            column: numberCol,
          })
        ).toBe(6);
      });

      it('returns 0 for empty selection', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.Count,
            values: [],
            column: numberCol,
          })
        ).toBe(0);
      });
    });

    describe('CountEmpty / CountFilled', () => {
      it('Number: only null counts as empty (0 is filled)', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountEmpty,
            values: [0, 1, null, 2, null, 0],
            column: numberCol,
          })
        ).toBe(2);
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountFilled,
            values: [0, 1, null, 2, null, 0],
            column: numberCol,
          })
        ).toBe(4);
      });

      it('Rating: 0 counts as empty', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountEmpty,
            values: [0, 1, null, 2, 0],
            column: ratingCol,
          })
        ).toBe(3);
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountFilled,
            values: [0, 1, null, 2, 0],
            column: ratingCol,
          })
        ).toBe(2);
      });

      it('Text: empty string counts as empty', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountEmpty,
            values: ['', 'a', null, 'b', ''],
            column: textCol,
          })
        ).toBe(3);
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountFilled,
            values: ['', 'a', null, 'b', ''],
            column: textCol,
          })
        ).toBe(2);
      });

      it('JSON: non-array values count as empty', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountEmpty,
            values: [
              [1, 2],
              null,
              '[3,4]',
              '{"k":1}',
              'not-json',
              { foo: 1 },
              [],
            ],
            column: jsonCol,
          })
        ).toBe(4); // null, '{...}', 'not-json', { foo: 1 } — non-arrays
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountFilled,
            values: [
              [1, 2],
              null,
              '[3,4]',
              '{"k":1}',
              'not-json',
              { foo: 1 },
              [],
            ],
            column: jsonCol,
          })
        ).toBe(3); // [1,2], '[3,4]', []
      });

      it('handles all-null Number column', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountEmpty,
            values: [null, null, null],
            column: numberCol,
          })
        ).toBe(3);
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountFilled,
            values: [null, null, null],
            column: numberCol,
          })
        ).toBe(0);
      });
    });

    describe('CountUnique', () => {
      it('Number: distinct non-null values', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountUnique,
            values: [1, 2, 2, 3, null, 1, null],
            column: numberCol,
          })
        ).toBe(3);
      });

      it('Rating: 0s excluded from unique set', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountUnique,
            values: [0, 1, 2, 1, 0, 3, null],
            column: ratingCol,
          })
        ).toBe(3);
      });

      it('Text: empty strings excluded', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountUnique,
            values: ['', 'a', 'b', 'a', '', null, 'c'],
            column: textCol,
          })
        ).toBe(3);
      });

      it('handles 1.0 and 1 as the same number', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.CountUnique,
            values: [1.0, 1, 1.5, 2],
            column: numberCol,
          })
        ).toBe(3);
      });
    });

    describe('Percent variants', () => {
      it('PercentEmpty / PercentFilled / PercentUnique sum coherently', () => {
        const values = [1, 2, 2, null, null, 3];
        const empty = computeAggregation({
          aggregation: CommonAggregations.PercentEmpty,
          values,
          column: numberCol,
        }) as number;
        const filled = computeAggregation({
          aggregation: CommonAggregations.PercentFilled,
          values,
          column: numberCol,
        }) as number;
        const unique = computeAggregation({
          aggregation: CommonAggregations.PercentUnique,
          values,
          column: numberCol,
        }) as number;
        expect(close(empty + filled, 100)).toBe(true);
        expect(filled).toBeCloseTo(
          (4 / 6) * 100
        ); // 4 non-null out of 6
        expect(unique).toBeCloseTo(
          (3 / 6) * 100
        ); // 1, 2, 3 distinct
      });

      it('returns 0 for empty selection (matches SQL COALESCE)', () => {
        expect(
          computeAggregation({
            aggregation: CommonAggregations.PercentEmpty,
            values: [],
            column: numberCol,
          })
        ).toBe(0);
        expect(
          computeAggregation({
            aggregation: CommonAggregations.PercentFilled,
            values: [],
            column: numberCol,
          })
        ).toBe(0);
      });
    });
  });

  describe('NumericalAggregations', () => {
    describe('Sum', () => {
      it('sums Decimal values matching the Parties example (1.1+2.2=3.3)', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Sum,
            values: [1.1, 2.2],
            column: decimalCol,
          })
        ).toBeCloseTo(3.3);
      });

      it('sums full-table example matching the Parties example (16.5)', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Sum,
            values: [1.1, 2.2, 3.3, 4.4, 5.5],
            column: decimalCol,
          })
        ).toBeCloseTo(16.5);
      });

      it('skips null values', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Sum,
            values: [1, null, 2, null, 3],
            column: numberCol,
          })
        ).toBe(6);
      });

      it('coerces numeric strings', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Sum,
            values: ['1', '2', '3'],
            column: numberCol,
          })
        ).toBe(6);
      });

      it('returns 0 for empty selection (COALESCE)', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Sum,
            values: [],
            column: numberCol,
          })
        ).toBe(0);
      });

      it('returns 0 when all values are null', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Sum,
            values: [null, null, null],
            column: numberCol,
          })
        ).toBe(0);
      });

      it('Rating: includes 0s in Sum (matches SQL SUM, not the 0-skipping variants)', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Sum,
            values: [0, 1, 2, 0, 3],
            column: ratingCol,
          })
        ).toBe(6);
      });
    });

    describe('Avg', () => {
      it('basic average', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Avg,
            values: [1, 2, 3, 4, 5],
            column: numberCol,
          })
        ).toBe(3);
      });

      it('skips nulls', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Avg,
            values: [2, null, 4],
            column: numberCol,
          })
        ).toBe(3);
      });

      it('Rating: skips 0s when computing average', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Avg,
            values: [0, 1, 2, 3, 0],
            column: ratingCol,
          })
        ).toBe(2); // (1+2+3)/3
      });

      it('Number column: 0 IS counted in average', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Avg,
            values: [0, 1, 2, 3, 0],
            column: numberCol,
          })
        ).toBeCloseTo(6 / 5);
      });

      it('returns 0 for empty selection', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Avg,
            values: [],
            column: numberCol,
          })
        ).toBe(0);
      });
    });

    describe('Min / Max', () => {
      it('Number: basic min/max', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Min,
            values: [3, 1, 4, 1, 5, 9, 2],
            column: numberCol,
          })
        ).toBe(1);
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Max,
            values: [3, 1, 4, 1, 5, 9, 2],
            column: numberCol,
          })
        ).toBe(9);
      });

      it('handles negatives', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Min,
            values: [-5, -2, -10, 0, 3],
            column: numberCol,
          })
        ).toBe(-10);
      });

      it('Rating: Min skips 0, Max does not', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Min,
            values: [0, 1, 2, 3],
            column: ratingCol,
          })
        ).toBe(1);
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Max,
            values: [0, 1, 2, 3],
            column: ratingCol,
          })
        ).toBe(3);
      });

      it('Min on empty / all-null returns 0', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Min,
            values: [],
            column: numberCol,
          })
        ).toBe(0);
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Min,
            values: [null, null],
            column: numberCol,
          })
        ).toBe(0);
      });
    });

    describe('Range', () => {
      it('Number: max - min', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Range,
            values: [1, 5, 3, 9, 2],
            column: numberCol,
          })
        ).toBe(8);
      });

      it('Rating: max(all) - min(no zeros)', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Range,
            values: [0, 1, 2, 3, 0],
            column: ratingCol,
          })
        ).toBe(2); // max=3, min(non-0)=1
      });

      it('Rating with all zeros returns 0', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Range,
            values: [0, 0, 0],
            column: ratingCol,
          })
        ).toBe(0);
      });
    });

    describe('Median', () => {
      it('odd length: middle value', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Median,
            values: [1, 5, 3, 9, 2],
            column: numberCol,
          })
        ).toBe(3);
      });

      it('even length: average of two middle values', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Median,
            values: [1, 2, 3, 4],
            column: numberCol,
          })
        ).toBe(2.5);
      });

      it('skips nulls', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Median,
            values: [null, 1, null, 5, 3],
            column: numberCol,
          })
        ).toBe(3);
      });

      it('returns 0 for empty', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.Median,
            values: [],
            column: numberCol,
          })
        ).toBe(0);
      });
    });

    describe('StandardDeviation', () => {
      it('population stddev over non-null values', () => {
        // values = [1, 2, 3], avg = 2, sumSq = 2, n = 3 → sqrt(2/3)
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.StandardDeviation,
            values: [1, 2, 3],
            column: numberCol,
          }) as number
        ).toBeCloseTo(Math.sqrt(2 / 3));
      });

      it('null rows are excluded from the divisor (matches PG stddev_pop / MySQL STDDEV)', () => {
        // values = [1, 2, 3, null], avg = 2, sumSq = 2, n = 3 → sqrt(2/3)
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.StandardDeviation,
            values: [1, 2, 3, null],
            column: numberCol,
          }) as number
        ).toBeCloseTo(Math.sqrt(2 / 3));
      });

      it('Rating: skips 0s like Avg/Min (matches PG `stddev_pop FILTER WHERE != 0`)', () => {
        // values = [0, 0, 1, 5], pool = [1, 5], avg = 3, sumSq = 4+4 = 8, n = 2 → sqrt(8/2) = 2
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.StandardDeviation,
            values: [0, 0, 1, 5],
            column: ratingCol,
          }) as number
        ).toBeCloseTo(2);
      });

      it('Rating: all-zero pool returns 0', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.StandardDeviation,
            values: [0, 0, 0],
            column: ratingCol,
          })
        ).toBe(0);
      });

      it('returns 0 for empty', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.StandardDeviation,
            values: [],
            column: numberCol,
          })
        ).toBe(0);
      });

      it('returns 0 when all values are null', () => {
        expect(
          computeAggregation({
            aggregation: NumericalAggregations.StandardDeviation,
            values: [null, null, null],
            column: numberCol,
          })
        ).toBe(0);
      });
    });
  });

  describe('BooleanAggregations (Checkbox)', () => {
    it('counts checked / unchecked with various truthy reps', () => {
      const values = [true, false, 1, 0, '1', 'true', null, undefined];
      expect(
        computeAggregation({
          aggregation: BooleanAggregations.Checked,
          values,
          column: checkboxCol,
        })
      ).toBe(4); // true, 1, '1', 'true'
      expect(
        computeAggregation({
          aggregation: BooleanAggregations.Unchecked,
          values,
          column: checkboxCol,
        })
      ).toBe(4);
    });

    it('null/undefined count as unchecked (matches SQL `x = 0 OR x IS NULL`)', () => {
      expect(
        computeAggregation({
          aggregation: BooleanAggregations.Unchecked,
          values: [null, null, true],
          column: checkboxCol,
        })
      ).toBe(2);
    });

    it('Percent variants on empty selection return 0', () => {
      expect(
        computeAggregation({
          aggregation: BooleanAggregations.PercentChecked,
          values: [],
          column: checkboxCol,
        })
      ).toBe(0);
    });

    it('PercentChecked + PercentUnchecked = 100 on non-empty', () => {
      const values = [true, false, true, true, null];
      const c = computeAggregation({
        aggregation: BooleanAggregations.PercentChecked,
        values,
        column: checkboxCol,
      }) as number;
      const u = computeAggregation({
        aggregation: BooleanAggregations.PercentUnchecked,
        values,
        column: checkboxCol,
      }) as number;
      expect(close(c + u, 100)).toBe(true);
    });
  });

  describe('DateAggregations', () => {
    it('EarliestDate / LatestDate: ISO date strings', () => {
      const values = ['2026-04-28', '2024-01-15', '2025-12-31', null, ''];
      expect(
        computeAggregation({
          aggregation: DateAggregations.EarliestDate,
          values,
          column: dateCol,
        })
      ).toBe('2024-01-15');
      expect(
        computeAggregation({
          aggregation: DateAggregations.LatestDate,
          values,
          column: dateCol,
        })
      ).toBe('2026-04-28');
    });

    it('EarliestDate / LatestDate: Date objects and numeric timestamps (not just ISO strings)', () => {
      // String compare would put '1700000000000' (number) before '2024-01-15'
      // alphabetically — chronological compare keeps the actual earliest.
      const dateObj = new Date('2023-06-01');
      const ts = new Date('2026-09-01').getTime();
      const iso = '2024-01-15';
      expect(
        computeAggregation({
          aggregation: DateAggregations.EarliestDate,
          values: [iso, dateObj, ts],
          column: dateCol,
        })
      ).toBe(dateObj);
      expect(
        computeAggregation({
          aggregation: DateAggregations.LatestDate,
          values: [iso, dateObj, ts],
          column: dateCol,
        })
      ).toBe(ts);
    });

    it('EarliestDate on empty returns null (no COALESCE — matches SQL exception)', () => {
      expect(
        computeAggregation({
          aggregation: DateAggregations.EarliestDate,
          values: [],
          column: dateCol,
        })
      ).toBeNull();
      expect(
        computeAggregation({
          aggregation: DateAggregations.LatestDate,
          values: [null, ''],
          column: dateCol,
        })
      ).toBeNull();
    });

    it('DateRange: integer days truncated', () => {
      expect(
        computeAggregation({
          aggregation: DateAggregations.DateRange,
          values: ['2026-04-28', '2024-01-15'],
          column: dateCol,
        })
      ).toBe(834); // ((2026-04-28) - (2024-01-15)) days
    });

    it('DateRange across DateTime: half-day truncates to whole', () => {
      expect(
        computeAggregation({
          aggregation: DateAggregations.DateRange,
          values: [
            '2026-05-05T12:00:00Z',
            '2026-05-04T00:00:00Z',
          ],
          column: dateTimeCol,
        })
      ).toBe(1); // 1.5 days → trunc to 1
    });

    it('DateRange on empty returns 0 (COALESCE)', () => {
      expect(
        computeAggregation({
          aggregation: DateAggregations.DateRange,
          values: [],
          column: dateCol,
        })
      ).toBe(0);
    });

    it('MonthRange: same year', () => {
      expect(
        computeAggregation({
          aggregation: DateAggregations.MonthRange,
          values: ['2026-01-01', '2026-05-31'],
          column: dateCol,
        })
      ).toBe(4);
    });

    it('MonthRange across years', () => {
      expect(
        computeAggregation({
          aggregation: DateAggregations.MonthRange,
          values: ['2024-11-30', '2026-02-15'],
          column: dateCol,
        })
      ).toBe(15); // (2026*12+2) - (2024*12+11) = 24290 - 24299 wait... let me recompute
      // (2026*12+2) = 24314; (2024*12+11) = 24299; diff = 15 ✓
    });
  });

  describe('AttachmentAggregations', () => {
    it('sums size across attachment arrays', () => {
      const values = [
        [{ size: 100 }, { size: 200 }],
        [{ size: 50 }],
        null,
        [],
        [{ size: 300 }],
      ];
      expect(
        computeAggregation({
          aggregation: AttachmentAggregations.AttachmentSize,
          values,
          column: attachmentCol,
        })
      ).toBe(650);
    });

    it('parses JSON-string attachment values', () => {
      const values = [
        JSON.stringify([{ size: 100 }, { size: 200 }]),
        JSON.stringify([{ size: 50 }]),
      ];
      expect(
        computeAggregation({
          aggregation: AttachmentAggregations.AttachmentSize,
          values,
          column: attachmentCol,
        })
      ).toBe(350);
    });

    it('skips null and unparseable values', () => {
      expect(
        computeAggregation({
          aggregation: AttachmentAggregations.AttachmentSize,
          values: [null, 'not-json', undefined, [{ size: 10 }]],
          column: attachmentCol,
        })
      ).toBe(10);
    });

    it('returns 0 on empty', () => {
      expect(
        computeAggregation({
          aggregation: AttachmentAggregations.AttachmentSize,
          values: [],
          column: attachmentCol,
        })
      ).toBe(0);
    });
  });

  describe('Formula columns', () => {
    it('NUMERIC formula treated like Number for empty checks', () => {
      const formulaNumeric = col(UITypes.Formula);
      // CountFilled: only null is empty, 0 is filled
      expect(
        computeAggregation({
          aggregation: CommonAggregations.CountFilled,
          values: [0, 1, null, 2, null, 0],
          column: formulaNumeric,
          parsedFormulaType: FormulaDataTypes.NUMERIC,
        })
      ).toBe(4);
    });

    it('STRING formula treated like text: empty string is empty', () => {
      const formulaString = col(UITypes.Formula);
      expect(
        computeAggregation({
          aggregation: CommonAggregations.CountFilled,
          values: ['', 'a', null, 'b'],
          column: formulaString,
          parsedFormulaType: FormulaDataTypes.STRING,
        })
      ).toBe(2);
    });

    it('DATE formula: only null is empty', () => {
      const formulaDate = col(UITypes.Formula);
      expect(
        computeAggregation({
          aggregation: CommonAggregations.CountFilled,
          values: ['2026-01-01', null, '2026-02-02', ''],
          column: formulaDate,
          parsedFormulaType: FormulaDataTypes.DATE,
        })
      ).toBe(3); // null is empty; '' is filled because mode is 'null'
    });
  });

  describe('Selection vs full-set parity (the key invariant)', () => {
    // The whole point of selection-mode: if you compute the same aggregation
    // over a subset, it should equal what you'd get from feeding the same
    // subset to the SQL aggregation. We can't test SQL here, but we CAN test
    // that splitting + recombining behaves consistently.

    it('Sum: f(full) === f(left) + f(right) when split', () => {
      const all = [1.1, 2.2, 3.3, 4.4, 5.5];
      const full = computeAggregation({
        aggregation: NumericalAggregations.Sum,
        values: all,
        column: decimalCol,
      }) as number;
      const left = computeAggregation({
        aggregation: NumericalAggregations.Sum,
        values: all.slice(0, 2),
        column: decimalCol,
      }) as number;
      const right = computeAggregation({
        aggregation: NumericalAggregations.Sum,
        values: all.slice(2),
        column: decimalCol,
      }) as number;
      expect(close(left + right, full, 1e-9)).toBe(true);
    });

    it('Count: f(full) === f(left) + f(right) when split', () => {
      const all = [1, 2, null, 'x', 0];
      const full = computeAggregation({
        aggregation: CommonAggregations.Count,
        values: all,
        column: numberCol,
      }) as number;
      const left = computeAggregation({
        aggregation: CommonAggregations.Count,
        values: all.slice(0, 3),
        column: numberCol,
      }) as number;
      const right = computeAggregation({
        aggregation: CommonAggregations.Count,
        values: all.slice(3),
        column: numberCol,
      }) as number;
      expect(left + right).toBe(full);
    });

    it('Min over a subset matches min of subset values', () => {
      const all = [9, 3, 7, 2, 5];
      const subsetIndices = [1, 3, 4]; // values [3, 2, 5]
      const subset = subsetIndices.map((i) => all[i]);
      expect(
        computeAggregation({
          aggregation: NumericalAggregations.Min,
          values: subset,
          column: numberCol,
        })
      ).toBe(2);
    });

    it('CountUnique over a subset uses only subset values', () => {
      const all = ['a', 'b', 'c', 'a', 'b'];
      const subsetIndices = [0, 2, 3]; // ['a', 'c', 'a']
      const subset = subsetIndices.map((i) => all[i]);
      expect(
        computeAggregation({
          aggregation: CommonAggregations.CountUnique,
          values: subset,
          column: textCol,
        })
      ).toBe(2);
    });

    it('PercentFilled scales correctly per-subset', () => {
      const all = [1, null, 2, null, 3, null];
      // Full: 3/6 = 50%
      const full = computeAggregation({
        aggregation: CommonAggregations.PercentFilled,
        values: all,
        column: numberCol,
      }) as number;
      expect(full).toBe(50);
      // Subset [0..2] = [1, null, 2]: 2/3 = 66.67%
      const sub = computeAggregation({
        aggregation: CommonAggregations.PercentFilled,
        values: all.slice(0, 3),
        column: numberCol,
      }) as number;
      expect(sub).toBeCloseTo((2 / 3) * 100);
    });

    it('AVG of subset != AVG of full unless subset is representative', () => {
      const all = [1, 2, 3, 4, 5];
      expect(
        computeAggregation({
          aggregation: NumericalAggregations.Avg,
          values: all,
          column: numberCol,
        })
      ).toBe(3);
      expect(
        computeAggregation({
          aggregation: NumericalAggregations.Avg,
          values: all.slice(0, 2),
          column: numberCol,
        })
      ).toBe(1.5);
    });

    it('Selection of single cell behaves like single-value reduce', () => {
      expect(
        computeAggregation({
          aggregation: NumericalAggregations.Sum,
          values: [42],
          column: numberCol,
        })
      ).toBe(42);
      expect(
        computeAggregation({
          aggregation: NumericalAggregations.Avg,
          values: [42],
          column: numberCol,
        })
      ).toBe(42);
      expect(
        computeAggregation({
          aggregation: NumericalAggregations.Median,
          values: [42],
          column: numberCol,
        })
      ).toBe(42);
      expect(
        computeAggregation({
          aggregation: NumericalAggregations.Range,
          values: [42],
          column: numberCol,
        })
      ).toBe(0);
    });
  });
});
