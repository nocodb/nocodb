import { Test } from '@nestjs/testing';
import { SharedBasesService } from '../services/shared-bases.service';
import { SharedBasesController } from './shared-bases.controller';
import type { TestingModule } from '@nestjs/testing';

describe('SharedBasesController', () => {
  let controller: SharedBasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharedBasesController],
      providers: [SharedBasesService],
    }).compile();

    controller = module.get<SharedBasesController>(SharedBasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
