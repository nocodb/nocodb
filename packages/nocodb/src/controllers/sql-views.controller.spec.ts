import { Test } from '@nestjs/testing';
import { SqlViewsController } from './sql-views.controller';
import type { TestingModule } from '@nestjs/testing';

describe('SqlViewsController', () => {
  let controller: SqlViewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SqlViewsController],
    }).compile();

    controller = module.get<SqlViewsController>(SqlViewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
