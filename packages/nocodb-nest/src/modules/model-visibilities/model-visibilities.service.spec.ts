import { Test, TestingModule } from '@nestjs/testing';
import { ModelVisibilitiesService } from './model-visibilities.service';

describe('ModelVisibilitiesService', () => {
  let service: ModelVisibilitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ModelVisibilitiesService],
    }).compile();

    service = module.get<ModelVisibilitiesService>(ModelVisibilitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
