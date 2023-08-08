import { Test } from '@nestjs/testing';
import { AppHooksService } from './app-hooks.service';
import type { TestingModule } from '@nestjs/testing';

describe('AppHooksService', () => {
  let service: AppHooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppHooksService],
    }).compile();

    service = module.get<AppHooksService>(AppHooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
