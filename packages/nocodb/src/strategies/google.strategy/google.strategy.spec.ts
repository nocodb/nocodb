import { Test } from '@nestjs/testing';
import { GoogleStrategy } from './google.strategy';
import type { TestingModule } from '@nestjs/testing';

describe('GoogleStrategy', () => {
  let provider: GoogleStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleStrategy],
    }).compile();

    provider = module.get<GoogleStrategy>(GoogleStrategy);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
