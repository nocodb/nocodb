import { Test, TestingModule } from '@nestjs/testing';
import { MetaService } from './meta.service';

describe('MetaService', () => {
  let service: MetaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetaService],
    }).compile();

    service = module.get<MetaService>(MetaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
