import { Test, TestingModule } from '@nestjs/testing';
import { MetaDiffsService } from './meta-diffs.service';

describe('MetaDiffsService', () => {
  let service: MetaDiffsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetaDiffsService],
    }).compile();

    service = module.get<MetaDiffsService>(MetaDiffsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
