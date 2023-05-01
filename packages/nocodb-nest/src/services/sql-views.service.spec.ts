import { Test } from '@nestjs/testing';
import { SqlViewsService } from './sql-views.service';
import type { TestingModule } from '@nestjs/testing';

describe('SqlViewsService', () => {
  let service: SqlViewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SqlViewsService],
    }).compile();

    service = module.get<SqlViewsService>(SqlViewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
