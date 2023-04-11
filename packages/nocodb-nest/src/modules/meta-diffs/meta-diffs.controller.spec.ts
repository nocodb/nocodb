import { Test } from '@nestjs/testing';
import { MetaDiffsController } from './meta-diffs.controller';
import { MetaDiffsService } from './meta-diffs.service';
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
