import { Test } from '@nestjs/testing';
import { MetaDiffsService } from '../services/meta-diffs.service';
import { MetaDiffsController } from './meta-diffs.controller';
import type { TestingModule } from '@nestjs/testing';

describe('MetaDiffsController', () => {
  let controller: MetaDiffsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaDiffsController],
      providers: [MetaDiffsService],
    }).compile();

    controller = module.get<MetaDiffsController>(MetaDiffsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
