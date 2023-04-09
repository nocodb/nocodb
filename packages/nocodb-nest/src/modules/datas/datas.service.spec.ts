import { Test, TestingModule } from '@nestjs/testing';
import { DatasService } from './datas.service';

describe('DatasService', () => {
  let service: DatasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatasService],
    }).compile();

    service = module.get<DatasService>(DatasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
