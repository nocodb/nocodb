import { ColumnType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';
import { TimeHelper } from './Time';

describe('columnHelper', () => {
  describe('Time', () => {
    describe('equalityComparison', () => {
      it(`will compare two time`, () => {
        const column = {
          uidt: UITypes.Time,
          meta: {
            time_format: 'HH:mm',
          },
        } as ColumnType;
        const a = '02:15';
        const b = '1999-01-01 02:15:00+07:00';

        // Same wall-clock time-of-day (02:15) — equality must hold regardless
        // of the host timezone (the trailing +07:00 offset is ignored).
        const result = new TimeHelper().equalityComparison(a, b, {
          col: column,
        });
        expect(result).toBe(true);
      });

      it(`compares wall-clock across different zone offsets`, () => {
        const column = {
          uidt: UITypes.Time,
          meta: { time_format: 'HH:mm' },
        } as ColumnType;
        // Two values written in different offsets but the same wall-clock time.
        expect(
          new TimeHelper().equalityComparison(
            '1999-01-01 02:15:00+05:30',
            '1999-01-01 02:15:00+07:00',
            { col: column }
          )
        ).toBe(true);
      });

      it(`treats different times as not equal`, () => {
        const column = {
          uidt: UITypes.Time,
          meta: { time_format: 'HH:mm' },
        } as ColumnType;
        expect(
          new TimeHelper().equalityComparison('02:15', '03:15', {
            col: column,
          })
        ).toBe(false);
      });
    });
  });
});
