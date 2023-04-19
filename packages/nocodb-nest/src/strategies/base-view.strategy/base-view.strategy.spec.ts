import { Test } from '@nestjs/testing';
import { BaseViewStrategy } from './base-view.strategy';
import type { TestingModule } from '@nestjs/testing';

describe('BaseViewStrategy', () => {
  let provider: BaseViewStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BaseViewStrategy],
    }).compile();

    provider = module.get<BaseViewStrategy>(BaseViewStrategy);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
