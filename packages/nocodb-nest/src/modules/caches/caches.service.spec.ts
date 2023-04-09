import { Test, TestingModule } from '@nestjs/testing';
import { CachesService } from './caches.service';

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
