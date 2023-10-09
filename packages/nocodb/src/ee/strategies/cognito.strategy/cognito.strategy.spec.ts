import { Test } from '@nestjs/testing';
import { CognitoStrategy } from './openid.strategy';
import type { TestingModule } from '@nestjs/testing';

describe('OpenidStrategy', () => {
  let provider: CognitoStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CognitoStrategy],
    }).compile();

    provider = module.get<CognitoStrategy>(CognitoStrategy);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
