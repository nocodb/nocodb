import { Test } from '@nestjs/testing';
import { CachesController } from './caches.controller';
import { CachesService } from './caches.service';
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
