import { Test } from '@nestjs/testing';
import { ViewColumnsService } from './view-columns.service';
import type { TestingModule } from '@nestjs/testing';

describe('ViewColumnsService', () => {
  let service: ViewColumnsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ViewColumnsService],
    }).compile();

    service = module.get<ViewColumnsService>(ViewColumnsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
