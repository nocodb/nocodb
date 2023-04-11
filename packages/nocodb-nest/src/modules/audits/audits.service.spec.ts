import { Test } from '@nestjs/testing';
import { AuditsService } from './audits.service';
import type { TestingModule } from '@nestjs/testing';

describe('AuditsService', () => {
  let service: AuditsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditsService],
    }).compile();

    service = module.get<AuditsService>(AuditsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
