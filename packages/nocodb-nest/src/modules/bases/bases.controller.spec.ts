import { Test } from '@nestjs/testing';
import { BasesController } from './bases.controller';
import { BasesService } from './bases.service';
import type { TestingModule } from '@nestjs/testing';

describe('BasesController', () => {
  let controller: BasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BasesController],
      providers: [BasesService],
    }).compile();

    controller = module.get<BasesController>(BasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
