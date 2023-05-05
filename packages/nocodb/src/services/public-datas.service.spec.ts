import { Test } from '@nestjs/testing';
import { PublicDatasService } from './public-datas.service';
import type { TestingModule } from '@nestjs/testing';

describe('PublicDatasService', () => {
  let service: PublicDatasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicDatasService],
    }).compile();

    service = module.get<PublicDatasService>(PublicDatasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
