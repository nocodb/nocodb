import { Test } from '@nestjs/testing';
import { ModelVisibilitiesService } from '../services/model-visibilities.service';
import { ModelVisibilitiesController } from './model-visibilities.controller';
import type { TestingModule } from '@nestjs/testing';

describe('ModelVisibilitiesController', () => {
  let controller: ModelVisibilitiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelVisibilitiesController],
      providers: [ModelVisibilitiesService],
    }).compile();

    controller = module.get<ModelVisibilitiesController>(
      ModelVisibilitiesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
