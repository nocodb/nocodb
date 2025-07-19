import { detailedDiff, intersection } from './arrayHelpers';

describe('arrayHelpers', () => {
  describe('intersection', () => {
    it('will intersect 2 array', () => {
      const a = ['a', 'b', 'c'];
      const b = ['c', 'd', 'e'];
      const result = intersection(a, b);
      expect(result).toEqual(['c']);
    });
  });
  describe('detailedDiff', () => {
    it('will detailed diff 2 array', () => {
      const a = ['a', 'b', 'c'];
      const b = ['c', 'd', 'e'];
      const result = detailedDiff(a, b);
      expect(result).toEqual({
        removed: ['a', 'b'],
        intersected: ['c'],
        added: ['d', 'e'],
      });
    });
  });
});
