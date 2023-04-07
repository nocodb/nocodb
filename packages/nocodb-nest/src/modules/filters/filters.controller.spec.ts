import { Test, TestingModule } from '@nestjs/testing';
import { FiltersController } from './filters.controller';
import { FiltersService } from './filters.service';

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
