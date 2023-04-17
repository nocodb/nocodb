import { Test } from '@nestjs/testing';
import { PublicDatasExportService } from '../services/public-datas-export.service';
import { PublicDatasExportController } from './public-datas-export.controller';
import type { TestingModule } from '@nestjs/testing';

describe('PublicDatasExportController', () => {
  let controller: PublicDatasExportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicDatasExportController],
      providers: [PublicDatasExportService],
    }).compile();

    controller = module.get<PublicDatasExportController>(
      PublicDatasExportController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
