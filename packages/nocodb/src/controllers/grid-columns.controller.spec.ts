import { Test } from '@nestjs/testing';
import { GridColumnsService } from '../services/grid-columns.service';
import { GridColumnsController } from './grid-columns.controller';
import type { TestingModule } from '@nestjs/testing';

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
