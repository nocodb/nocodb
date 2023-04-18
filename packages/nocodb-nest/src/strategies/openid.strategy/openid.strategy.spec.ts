import { Test, TestingModule } from '@nestjs/testing';
import { OpenidStrategy } from './openid.strategy';

describe('OpenidStrategy', () => {
  let provider: OpenidStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenidStrategy],
    }).compile();

    provider = module.get<OpenidStrategy>(OpenidStrategy);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
