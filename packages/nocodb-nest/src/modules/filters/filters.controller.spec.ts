import { Test } from '@nestjs/testing';
import { FiltersController } from './filters.controller';
import { FiltersService } from './filters.service';
import type { TestingModule } from '@nestjs/testing';

describe('FiltersController', () => {
  let controller: FiltersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FiltersController],
      providers: [FiltersService],
    }).compile();

    controller = module.get<FiltersController>(FiltersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
