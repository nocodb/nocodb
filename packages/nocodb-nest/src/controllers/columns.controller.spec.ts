import { Test } from '@nestjs/testing';
import { ColumnsController } from './columns.controller';
import { ColumnsService } from '../services/columns.service';
import type { TestingModule } from '@nestjs/testing';

describe('ColumnsController', () => {
  let controller: ColumnsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ColumnsController],
      providers: [ColumnsService],
    }).compile();

    controller = module.get<ColumnsController>(ColumnsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
