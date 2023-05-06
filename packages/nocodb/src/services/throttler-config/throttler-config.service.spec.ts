import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerConfigService } from './throttler-config.service';

describe('ThrottlerConfigService', () => {
  let service: ThrottlerConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThrottlerConfigService],
    }).compile();

    service = module.get<ThrottlerConfigService>(ThrottlerConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
