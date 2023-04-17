import { Test } from '@nestjs/testing';
import { SortsService } from '../services/sorts.service';
import { SortsController } from './sorts.controller';
import type { TestingModule } from '@nestjs/testing';

describe('SortsController', () => {
  let controller: SortsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SortsController],
      providers: [SortsService],
    }).compile();

    controller = module.get<SortsController>(SortsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
