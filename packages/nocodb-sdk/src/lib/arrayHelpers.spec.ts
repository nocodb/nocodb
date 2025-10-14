import {
  arrDetailedDiff,
  arrFlattenChildren,
  arrIntersection,
} from './arrayHelpers';

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

  describe('arrFlattenChildren', () => {
    it('will flatten children', () => {
      const payload = [
        {
          name: 'foo',
          children: [
            {
              name: 'bar',
            },
            {
              name: 'baz',
            },
          ],
        },
        {
          name: 'foo2',
          children: [
            {
              name: 'bar2',
            },
            {
              name: 'baz2',
              children: [
                {
                  name: 'buz2',
                },
              ],
            },
          ],
        },
        {
          name: 'foo3',
        },
      ];
      const result = arrFlattenChildren<any, any>({
        payload,
        childHandle: (each) => {
          return each.children;
        },
      });
      expect(result.map((k) => k.name).join(',')).toBe(
        'foo,bar,baz,foo2,bar2,baz2,buz2,foo3'
      );
    });
  });
});
