import { Test } from '@nestjs/testing';
import { ExportImportService } from './export-import.service';
import type { TestingModule } from '@nestjs/testing';

describe('ExportImportService', () => {
  let service: ExportImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExportImportService],
    }).compile();

    service = module.get<ExportImportService>(ExportImportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
