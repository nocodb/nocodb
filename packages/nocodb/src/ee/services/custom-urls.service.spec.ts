import { Test } from '@nestjs/testing';
import { CustomUrlsService } from './custom-urls.service';
import type { TestingModule } from '@nestjs/testing';

describe('CustomUrlsService', () => {
  let service: CustomUrlsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomUrlsService],
    }).compile();

    service = module.get<CustomUrlsService>(CustomUrlsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
