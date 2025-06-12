import {
  populateFillHandleStrictCopy,
  populateFillHandleStringNumber,
} from './fill-handler';

describe('fill-handler.utils', () => {
  describe('populateFillHandleStringNumber', () => {
    it('will populate number value', () => {
      const data = ['2', '4', '6', 8];
      const result = populateFillHandleStringNumber({
        highlightedData: data,
        column: {} as any,
        numberOfRows: 8,
      });
      expect(result).toEqual(['10', '12', '14', '16']);
    });
    it('will populate combined string value', () => {
      const data = ['1A1', '2', '4', '1A2', '6', 8, '1A3'];
      const result = populateFillHandleStringNumber({
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
      const result = populateFillHandleStringNumber({
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
      const result = populateFillHandleStringNumber({
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
    it.only('will populate descending combined string value', () => {
      const data = ['1A4', '4', '3', '1A3', '2', 1, '1A2'];
      const result = populateFillHandleStringNumber({
        highlightedData: data,
        column: {} as any,
        numberOfRows: 16,
      });
      expect(result).toEqual([
        '1A1',
        '0',
        '1',
        '1A0',
        '2',
        '3',
        '1A1',
        '1A2',
        '4',
      ]);
    });
  });

  describe('populateFillHandleStrictCopy', () => {
    it('will populate number value by strict copy', () => {
      const data = ['2', '4', '6', 8];
      const result = populateFillHandleStrictCopy({
        highlightedData: data,
        column: {} as any,
        numberOfRows: 8,
      });
      expect(result).toEqual(['2', '4', '6', 8]);
    });
    it('will populate number value by strict copy with combination and null values', () => {
      const data = ['2', '4', '6', 8, '1A', '1B', null, undefined, ''];
      const result = populateFillHandleStrictCopy({
        highlightedData: data,
        column: {} as any,
        numberOfRows: 20,
      });
      expect(result).toEqual([
        '2',
        '4',
        '6',
        8,
        '1A',
        '1B',
        null,
        undefined,
        '',
        '2',
        '4',
      ]);
    });
  });
});
