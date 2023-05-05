import { Test } from '@nestjs/testing';
import { GalleriesService } from './galleries.service';
import type { TestingModule } from '@nestjs/testing';

describe('GalleriesService', () => {
  let service: GalleriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GalleriesService],
    }).compile();

    service = module.get<GalleriesService>(GalleriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
