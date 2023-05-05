import { Test } from '@nestjs/testing';
import { ExportImportService } from './../services/export-import.service';
import { ExportImportController } from './export-import.controller';
import type { TestingModule } from '@nestjs/testing';

describe('ExportImportController', () => {
  let controller: ExportImportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportImportController],
      providers: [ExportImportService],
    }).compile();

    controller = module.get<ExportImportController>(ExportImportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
