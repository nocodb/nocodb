import { Test, TestingModule } from '@nestjs/testing';
import { ModelVisibilitiesController } from './model-visibilities.controller';
import { ModelVisibilitiesService } from './model-visibilities.service';

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
