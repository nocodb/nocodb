import { Test } from '@nestjs/testing';
import { TablesService } from '../services/tables.service';
import { TablesController } from './tables.controller';
import type { TestingModule } from '@nestjs/testing';

describe('TablesController', () => {
  let controller: TablesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TablesController],
      providers: [TablesService],
    }).compile();

    controller = module.get<TablesController>(TablesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
