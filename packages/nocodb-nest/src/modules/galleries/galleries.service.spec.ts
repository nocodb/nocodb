import { Test, TestingModule } from '@nestjs/testing';
import { GalleriesService } from './galleries.service';

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
