import { Test } from '@nestjs/testing';
import { KanbansService } from '../services/kanbans.service';
import { KanbansController } from './kanbans.controller';
import type { TestingModule } from '@nestjs/testing';

describe('KanbansController', () => {
  let controller: KanbansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KanbansController],
      providers: [KanbansService],
    }).compile();

    controller = module.get<KanbansController>(KanbansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
