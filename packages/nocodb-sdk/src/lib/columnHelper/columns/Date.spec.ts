import { DateHelper } from './Date';

describe('Date', () => {
  describe('populateFillHandle', () => {
    it('will populate with strict copy because some is empty', () => {
      const highlightedData = ['2025-01-01', '', '2025-01-02', '2025-01-03'];
      const column = { meta: { date_format: 'YYYY-MM-DD' } };
      const result = new DateHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 8,
      });
      expect(result).toEqual(highlightedData);
    });
    it('will populate with strict copy because the modifier is not same', () => {
      const highlightedData = ['2025-01-01', '2025-01-03', '2025-01-04'];
      const column = { meta: { date_format: 'YYYY-MM-DD' } };
      const result = new DateHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(highlightedData);
    });
    it('will populate with strict copy because the modifier is 0', () => {
      const highlightedData = ['2025-01-01', '2025-01-01', '2025-01-01'];
      const column = { meta: { date_format: 'YYYY-MM-DD' } };
      const result = new DateHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(highlightedData);
    });
    it('will populate with incremental 1 day', () => {
      const highlightedData = ['2025-01-01', '2025-01-02', '2025-01-03'];
      const column = { meta: { date_format: 'YYYY-MM-DD' } };
      const result = new DateHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(['2025-01-04', '2025-01-05', '2025-01-06']);
    });
    it('will populate with incremental 2 days', () => {
      const highlightedData = ['2025-01-25', '2025-01-27', '2025-01-29'];
      const column = { meta: { date_format: 'YYYY-MM-DD' } };
      const result = new DateHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(['2025-01-31', '2025-02-02', '2025-02-04']);
    });
    it('will populate with incremental 1 month', () => {
      const highlightedData = ['2025-01-02', '2025-02-02', '2025-03-02'];
      const column = { meta: { date_format: 'YYYY-MM-DD' } };
      const result = new DateHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(['2025-04-02', '2025-05-02', '2025-06-02']);
    });
    it('will populate with decrement 2 days with MM/DD/YYYY format', () => {
      const highlightedData = ['02/04/2025', '02/02/2025', '01/31/2025'];
      const column = { meta: { date_format: 'MM/DD/YYYY' } };
      const result = new DateHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(['01/29/2025', '01/27/2025', '01/25/2025']);
    });
    it('will populate with decrement 2 days', () => {
      const highlightedData = ['2025-02-04', '2025-02-02', '2025-01-31'];
      const column = { meta: { date_format: 'YYYY-MM-DD' } };
      const result = new DateHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(['2025-01-29', '2025-01-27', '2025-01-25']);
    });
  });
});
