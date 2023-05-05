import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerExpiryListenerService } from './throttler-expiry-listener.service';

describe('ThrottlerExpiryListenerService', () => {
  let service: ThrottlerExpiryListenerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThrottlerExpiryListenerService],
    }).compile();

    service = module.get<ThrottlerExpiryListenerService>(ThrottlerExpiryListenerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
