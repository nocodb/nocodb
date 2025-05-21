import { Test } from '@nestjs/testing';
import { DataTableController } from './data-table.controller';
import type { TestingModule } from '@nestjs/testing';

describe('DataTableController', () => {
  let controller: DataTableController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataTableController],
    }).compile();

    controller = module.get<DataTableController>(DataTableController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
