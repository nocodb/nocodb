import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

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
