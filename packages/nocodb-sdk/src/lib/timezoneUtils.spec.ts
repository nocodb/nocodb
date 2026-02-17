import {
  getNodejsTimezone,
  isDateTimeStringHasTimezone,
} from './timezoneUtils';

describe('timezoneUtils', () => {
  describe('getNodejsTimezone', () => {
    it('will get Asia/Kolkata', () => {
      expect(getNodejsTimezone('Asia/Kolkata', 'Asia/Jakarta')).toBe(
        'Asia/Calcutta'
      );
    });
  });
  describe('isDateTimeStringHasTimezone', () => {
    it('will evaluate some test cases', () => {
      // Test cases with expected values
      const testCases = [
        { value: '2024-10-14T10:30:00Z', expected: true },
        { value: '2024-10-14T10:30:00+05:30', expected: true },
        { value: '2024-10-14T10:30:00+0530', expected: true },
        { value: '2024-10-14T10:30:00-08:00', expected: true },
        { value: '2024-10-14 10:30:00 EST', expected: true },
        { value: '2024-10-14 10:30:00 GMT', expected: true },
        { value: 'Mon Oct 14 2024 10:30:00 GMT+0530', expected: true },
        { value: '2024-10-14 10:30:00 (PST)', expected: true },
        { value: '2024-10-14 10:30:00', expected: false },
        { value: '2024-10-14T10:30:00', expected: false },
        { value: '10/14/2024 10:30 AM', expected: false },
        { value: 'Mon Oct 14 10:30:00 2024', expected: false },
      ];
      const failed: string[] = [];

      testCases.forEach(({ value, expected }) => {
        const result = isDateTimeStringHasTimezone(value);

        if (result !== expected) {
          failed.push(`${value} is expected ${expected} but found ${result}`);
        }
      });

      if (failed.length) {
        console.log(failed);
      }
      expect(failed.length).toBe(0);
    });
  });
});
