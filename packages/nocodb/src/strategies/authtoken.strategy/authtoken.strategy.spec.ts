import { Test } from '@nestjs/testing';
import { AuthTokenStrategy } from './authtoken.strategy';
import type { TestingModule } from '@nestjs/testing';

describe('AuthtokenStrategy', () => {
  let provider: AuthTokenStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthTokenStrategy],
    }).compile();

    provider = module.get<AuthTokenStrategy>(AuthTokenStrategy);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
