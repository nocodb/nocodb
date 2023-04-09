import { Test, TestingModule } from '@nestjs/testing';
import { GridsController } from './grids.controller';
import { GridsService } from './grids.service';

describe('GridsController', () => {
  let controller: GridsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GridsController],
      providers: [GridsService],
    }).compile();

    controller = module.get<GridsController>(GridsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
