import { Test, TestingModule } from '@nestjs/testing';
import { GridsService } from './grids.service';

describe('GridsService', () => {
  let service: GridsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GridsService],
    }).compile();

    service = module.get<GridsService>(GridsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
