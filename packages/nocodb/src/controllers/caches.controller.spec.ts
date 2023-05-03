import { Test } from '@nestjs/testing';
import { CachesService } from '../services/caches.service';
import { CachesController } from './caches.controller';
import type { TestingModule } from '@nestjs/testing';

describe('CachesController', () => {
  let controller: CachesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CachesController],
      providers: [CachesService],
    }).compile();

    controller = module.get<CachesController>(CachesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
