import { DateTimeHelper } from './DateTime';

describe('Date', () => {
  describe('populateFillHandle', () => {
    it('will populate with strict copy because some is empty', () => {
      const highlightedData = [
        '2025-01-01 00:00:00',
        '',
        '2025-01-02 00:00:00',
        '2025-01-03 00:00:00',
      ];
      const column = {
        meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm:ss' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 8,
      });
      expect(result).toEqual(highlightedData);
    });
    it('will populate with strict copy because the modifier is not same', () => {
      const highlightedData = [
        '2025-01-01 00:00:00',
        '2025-01-03 00:00:00',
        '2025-01-04 00:00:00',
      ];
      const column = {
        meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm:ss' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(highlightedData);
    });
    it('will populate with strict copy because the modifier is 0', () => {
      const highlightedData = [
        '2025-01-01 00:00:00',
        '2025-01-01 00:00:00',
        '2025-01-01 00:00:00',
      ];
      const column = {
        meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm:ss' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual(highlightedData);
    });
    it('will populate with incremental 1 minute', () => {
      const highlightedData = [
        '2025-01-01 00:01',
        '2025-01-01 00:02',
        '2025-01-01 00:03',
      ];
      const column = {
        meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual([
        '2025-01-01 00:04',
        '2025-01-01 00:05',
        '2025-01-01 00:06',
      ]);
    });
    it('will populate with incremental 15 minutes', () => {
      const highlightedData = [
        '2025-01-01 23:15',
        '2025-01-01 23:30',
        '2025-01-01 23:45',
      ];
      const column = {
        meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual([
        '2025-01-02 00:00',
        '2025-01-02 00:15',
        '2025-01-02 00:30',
      ]);
    });
    it('will populate with incremental 15 seconds', () => {
      const highlightedData = [
        '2025-01-01 23:59:15',
        '2025-01-01 23:59:30',
        '2025-01-01 23:59:45',
      ];
      const column = {
        meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm:ss' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual([
        '2025-01-02 00:00:00',
        '2025-01-02 00:00:15',
        '2025-01-02 00:00:30',
      ]);
    });
    it('will populate with incremental 1 month', () => {
      const highlightedData = [
        '2025-01-02 00:00:00',
        '2025-02-02 00:00:00',
        '2025-03-02 00:00:00',
      ];
      const column = {
        meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm:ss' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual([
        '2025-04-02 00:00:00',
        '2025-05-02 00:00:00',
        '2025-06-02 00:00:00',
      ]);
    });
    it('will populate with decrement 2 days with MM/DD/YYYY format', () => {
      const highlightedData = [
        '02/04/2025 00:00:00',
        '02/02/2025 00:00:00',
        '01/31/2025 00:00:00',
      ];
      const column = {
        meta: { date_format: 'MM/DD/YYYY', time_format: 'HH:mm:ss' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual([
        '01/29/2025 00:00:00',
        '01/27/2025 00:00:00',
        '01/25/2025 00:00:00',
      ]);
    });
    it('will populate with decrement 2 days', () => {
      const highlightedData = [
        '2025-02-04 00:00:00',
        '2025-02-02 00:00:00',
        '2025-01-31 00:00:00',
      ];
      const column = {
        meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm:ss' },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual([
        '2025-01-29 00:00:00',
        '2025-01-27 00:00:00',
        '2025-01-25 00:00:00',
      ]);
    });
    it('will populate with incremental 15 minutes with AM/PM', () => {
      const highlightedData = [
        '2025-01-01 11:15 PM',
        '2025-01-01 11:30 PM',
        '2025-01-01 11:45 PM',
      ];
      const column = {
        meta: {
          date_format: 'YYYY-MM-DD',
          time_format: 'HH:mm',
          is12hrFormat: true,
        },
      };
      const result = new DateTimeHelper().populateFillHandle({
        column: column as any,
        highlightedData,
        numberOfRows: 6,
      });
      expect(result).toEqual([
        '2025-01-02 12:00 AM',
        '2025-01-02 12:15 AM',
        '2025-01-02 12:30 AM',
      ]);
    });
  });
});
