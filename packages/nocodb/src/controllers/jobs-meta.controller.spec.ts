import { Test } from '@nestjs/testing';
import { HooksService } from '../services/hooks.service';
import { JobsMetaController } from './jobs-meta.controller';
import type { TestingModule } from '@nestjs/testing';

describe('JobsMetaController', () => {
  let controller: JobsMetaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsMetaController],
      providers: [HooksService],
    }).compile();

    controller = module.get<JobsMetaController>(JobsMetaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
