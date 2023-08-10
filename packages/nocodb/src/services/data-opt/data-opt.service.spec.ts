import { Test } from '@nestjs/testing';
import { DataOptService } from './data-opt.service';
import type { TestingModule } from '@nestjs/testing';

describe('DataOptService', () => {
  let service: DataOptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataOptService],
    }).compile();

    service = module.get<DataOptService>(DataOptService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
