import { COMMON_TOKEN } from './common-token';

describe('common-token', () => {
  it(`will verify PAREN_START`, () => {
    const text = 'Hello, my (beautiful) world!';
    const textZero = 'Hello, my beautiful world!';
    const regex = new RegExp(COMMON_TOKEN.PAREN_START.PATTERN as any);
    expect(text.match(regex).length).toBeGreaterThan(0);
    expect(textZero.match(regex)).toBeNull();
  });
  it(`will verify PAREN_END`, () => {
    const text = 'Hello, my (beautiful) world!';
    const textZero = 'Hello, my beautiful world!';
    const regex = new RegExp(COMMON_TOKEN.PAREN_END.PATTERN as any);
    expect(text.match(regex).length).toBeGreaterThan(0);
    expect(textZero.match(regex)).toBeNull();
  });
});
