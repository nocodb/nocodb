import { Test } from '@nestjs/testing';
import { CachesService } from './caches.service';
import type { TestingModule } from '@nestjs/testing';

describe('CachesService', () => {
  let service: CachesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CachesService],
    }).compile();

    service = module.get<CachesService>(CachesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
