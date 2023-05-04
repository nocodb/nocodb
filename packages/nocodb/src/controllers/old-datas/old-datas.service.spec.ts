import { Test } from '@nestjs/testing';
import { OldDatasService } from './old-datas.service';
import type { TestingModule } from '@nestjs/testing';

describe('OldDatasService', () => {
  let service: OldDatasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OldDatasService],
    }).compile();

    service = module.get<OldDatasService>(OldDatasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
