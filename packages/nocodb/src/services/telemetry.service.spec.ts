import { Test } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import type { TestingModule } from '@nestjs/testing';

describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TelemetryService],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
