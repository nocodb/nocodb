import { Test, TestingModule } from '@nestjs/testing';
import { PublicDatasExportService } from './public-datas-export.service';

describe('PublicDatasExportService', () => {
  let service: PublicDatasExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicDatasExportService],
    }).compile();

    service = module.get<PublicDatasExportService>(PublicDatasExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
