import { Test } from '@nestjs/testing';
import { DatasService } from './datas.service';
import type { TestingModule } from '@nestjs/testing';

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
