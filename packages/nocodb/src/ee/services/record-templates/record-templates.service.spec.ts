import { Test } from '@nestjs/testing';
import { RecordTemplatesService } from './record-templates.service';
import type { TestingModule } from '@nestjs/testing';

describe('RecordTemplatesService', () => {
  let service: RecordTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecordTemplatesService],
    }).compile();

    service = module.get<RecordTemplatesService>(RecordTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
