import { Test } from '@nestjs/testing';
import { HooksController } from './hooks.controller';
import { HooksService } from '../services/hooks.service';
import type { TestingModule } from '@nestjs/testing';

describe('HooksController', () => {
  let controller: HooksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HooksController],
      providers: [HooksService],
    }).compile();

    controller = module.get<HooksController>(HooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
