import { Test } from '@nestjs/testing';
import { HooksService } from './hooks.service';
import type { TestingModule } from '@nestjs/testing';

describe('HooksService', () => {
  let service: HooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HooksService],
    }).compile();

    service = module.get<HooksService>(HooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
