import { numberize } from './numberUtils';

describe('numberUtils', () => {
  describe('numberize', () => {
    it('will be null when null is provided', () => {
      expect(numberize(null)).toBeNull();
    });
    it('will be undefined when undefined is provided', () => {
      expect(numberize(undefined)).toBeUndefined();
    });
    it('will be undefined when word is provided', () => {
      expect(numberize('hello')).toBeUndefined();
    });
    it('will be number when number string is provided', () => {
      expect(numberize('873')).toBe(873);
    });
    it('will be number when number is provided', () => {
      expect(numberize(873)).toBe(873);
    });
  });
});
