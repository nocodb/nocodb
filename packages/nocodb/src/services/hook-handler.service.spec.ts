import { Test } from '@nestjs/testing';
import { HookHandlerService } from './hook-handler.service';
import type { TestingModule } from '@nestjs/testing';

describe('HookHandlerService', () => {
  let service: HookHandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HookHandlerService],
    }).compile();

    service = module.get<HookHandlerService>(HookHandlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
