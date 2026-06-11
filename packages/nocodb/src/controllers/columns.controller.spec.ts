import { Test } from '@nestjs/testing';
import { ColumnsController } from './columns.controller';
import type { TestingModule } from '@nestjs/testing';
import { ColumnsService } from '~/services/columns.service';

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
