import { Test, TestingModule } from '@nestjs/testing';
import { SharedBasesService } from './shared-bases.service';

describe('SharedBasesService', () => {
  let service: SharedBasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SharedBasesService],
    }).compile();

    service = module.get<SharedBasesService>(SharedBasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
