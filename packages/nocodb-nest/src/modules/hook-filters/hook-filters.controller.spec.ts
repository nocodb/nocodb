import { Test, TestingModule } from '@nestjs/testing';
import { HookFiltersController } from './hook-filters.controller';
import { HookFiltersService } from './hook-filters.service';

describe('HookFiltersController', () => {
  let controller: HookFiltersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HookFiltersController],
      providers: [HookFiltersService],
    }).compile();

    controller = module.get<HookFiltersController>(HookFiltersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
