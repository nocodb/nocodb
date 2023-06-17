import { Test } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy';
import type { TestingModule } from '@nestjs/testing';

describe('LocalStrategy', () => {
  let provider: LocalStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalStrategy],
    }).compile();

    provider = module.get<LocalStrategy>(LocalStrategy);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
