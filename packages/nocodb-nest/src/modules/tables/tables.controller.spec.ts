import { Test, TestingModule } from '@nestjs/testing';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

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
