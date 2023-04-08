import { Test, TestingModule } from '@nestjs/testing';
import { BasesService } from './bases.service';

describe('BasesService', () => {
  let service: BasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BasesService],
    }).compile();

    service = module.get<BasesService>(BasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
