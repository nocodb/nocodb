import { Test } from '@nestjs/testing';
import { GridsService } from '../services/grids.service';
import { GridsController } from './grids.controller';
import type { TestingModule } from '@nestjs/testing';

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
