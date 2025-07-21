import { arrDetailedDiff, arrIntersection } from './arrayHelpers';

describe('arrayHelpers', () => {
  describe('arrIntersection', () => {
    it('will intersect 2 array', () => {
      const a = ['a', 'b', 'c'];
      const b = ['c', 'd', 'e'];
      const result = arrIntersection(a, b);
      expect(result).toEqual(['c']);
    });
  });
  describe('arrDetailedDiff', () => {
    it('will detailed diff 2 array', () => {
      const a = ['a', 'b', 'c'];
      const b = ['c', 'd', 'e'];
      const result = arrDetailedDiff(a, b);
      expect(result).toEqual({
        removed: ['a', 'b'],
        intersected: ['c'],
        added: ['d', 'e'],
      });
    });
  });
});
