import { Test } from '@nestjs/testing';
import { BasicStrategy } from './basic.strategy';
import type { TestingModule } from '@nestjs/testing';

describe('BasicStrategy', () => {
  let provider: BasicStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BasicStrategy],
    }).compile();

    provider = module.get<BasicStrategy>(BasicStrategy);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
