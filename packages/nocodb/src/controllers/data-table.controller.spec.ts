import { Test, TestingModule } from '@nestjs/testing';
import { DataTableController } from './data-table.controller';

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
