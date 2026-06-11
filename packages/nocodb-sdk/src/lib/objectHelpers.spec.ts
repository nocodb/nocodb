import { objRemoveEmptyStringProps } from './objectHelpers';

describe('objectHelpers', () => {
  describe('objRemoveEmptyStringProps', () => {
    it('will remove empty string property', () => {
      const a = {
        foo: 'bar',
        boo: '',
        baz: {
          foo: 'bar',
          boo: '',
          baz: [{ foo: 'bar', boo: '' }],
        },
      };
      const expected = {
        foo: 'bar',
        baz: {
          foo: 'bar',
          baz: [{ foo: 'bar' }],
        },
      };
      expect(objRemoveEmptyStringProps(a)).toEqual(expected);
    });
  });
});
