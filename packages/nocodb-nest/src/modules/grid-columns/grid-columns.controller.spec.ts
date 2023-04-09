import { Test, TestingModule } from '@nestjs/testing';
import { GridColumnsController } from './grid-columns.controller';
import { GridColumnsService } from './grid-columns.service';

describe('GridColumnsController', () => {
  let controller: GridColumnsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GridColumnsController],
      providers: [GridColumnsService],
    }).compile();

    controller = module.get<GridColumnsController>(GridColumnsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
