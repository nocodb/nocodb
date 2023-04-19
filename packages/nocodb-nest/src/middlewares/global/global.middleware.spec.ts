import { GlobalMiddleware } from './global.middleware';

describe('GlobalMiddleware', () => {
  it('should be defined', () => {
    expect(new GlobalMiddleware()).toBeDefined();
  });
});
