import { Test } from '@nestjs/testing';
import { UtilsService } from '../../../../services/utils.service';
import { WorkerController } from './worker.controller';
import type { TestingModule } from '@nestjs/testing';

describe('WorkerController', () => {
  let controller: WorkerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkerController],
      providers: [UtilsService],
    }).compile();

    controller = module.get<WorkerController>(WorkerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
