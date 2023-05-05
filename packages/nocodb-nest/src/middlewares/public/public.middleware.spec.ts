import { PublicMiddleware } from './public.middleware';

describe('PublicMiddleware', () => {
  it('should be defined', () => {
    expect(new PublicMiddleware()).toBeDefined();
  });
});
