import { SingleLineTextHelper } from './SingleLineText';

describe('SingleLineText', () => {
  describe('populateFillHandle', () => {
    it('will populate number value', () => {
      const data = ['2', '4', '6', 8];
      const result = new SingleLineTextHelper().populateFillHandle({
        highlightedData: data,
        column: {} as any,
        numberOfRows: 8,
      });
      expect(result).toEqual(['10', '12', '14', '16']);
    });
    it('will populate combined string value', () => {
      const data = ['1A1', '2', '4', '1A2', '6', 8, '1A3'];
      const result = new SingleLineTextHelper().populateFillHandle({
        highlightedData: data,
        column: {} as any,
        numberOfRows: 16,
      });
      expect(result).toEqual([
        '1A4',
        '10',
        '12',
        '1A5',
        '14',
        '16',
        '1A6',
        '1A7',
        '18',
      ]);
    });
    it('will populate combined string value without suffix', () => {
      const data = ['1A1', '1A2', '1A3', '1A', '1A4'];
      const result = new SingleLineTextHelper().populateFillHandle({
        highlightedData: data,
        column: {} as any,
        numberOfRows: 16,
      });

      expect(result).toEqual([
        '1A1',
        '1A2',
        '1A3',
        '1A',
        '1A4',
        '1A1',
        '1A2',
        '1A3',
        '1A',
        '1A4',
        '1A1',
      ]);
    });
    it('will populate combined value with empty cell', () => {
      const data = ['1A1', '1A2', '', null, undefined, '1A3'];
      const result = new SingleLineTextHelper().populateFillHandle({
        highlightedData: data,
        column: {} as any,
        numberOfRows: 16,
      });

      expect(result).toEqual([
        '1A4',
        '1A5',
        null,
        null,
        null,
        '1A6',
        '1A7',
        '1A8',
        null,
        null,
      ]);
    });
  });
});
