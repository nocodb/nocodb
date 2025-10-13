import { getNodejsTimezone } from './timezoneUtils';

describe('timezoneUtils', () => {
  describe('getNodejsTimezone', () => {
    it('will get Asia/Kolkata', () => {
      expect(getNodejsTimezone('Asia/Kolkata', 'Asia/Jakarta')).toBe(
        'Asia/Calcutta'
      );
    });
  });
});
