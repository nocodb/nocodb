import { Test } from '@nestjs/testing';
import { AuthtokenStrategy } from './authtoken.strategy';
import type { TestingModule } from '@nestjs/testing';

describe('AuthtokenStrategy', () => {
  let provider: AuthtokenStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthtokenStrategy],
    }).compile();

    provider = module.get<AuthtokenStrategy>(AuthtokenStrategy);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
