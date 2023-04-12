import { Test, TestingModule } from '@nestjs/testing';
import { GoogleStrategy } from './google.strategy';

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
