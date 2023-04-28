import { Test, TestingModule } from '@nestjs/testing';
import { ClickhouseService } from './clickhouse.service';

describe('ClickhouseService', () => {
  let service: ClickhouseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClickhouseService],
    }).compile();

    service = module.get<ClickhouseService>(ClickhouseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
