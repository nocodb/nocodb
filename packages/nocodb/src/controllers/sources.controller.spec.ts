import { Test } from '@nestjs/testing';
import { ProjectsService } from '../services/bases.service';
import { BasesController } from './bases.controller';
import type { TestingModule } from '@nestjs/testing';

describe('ProjectsController', () => {
  let controller: BasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BasesController],
      providers: [ProjectsService],
    }).compile();

    controller = module.get<BasesController>(BasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
