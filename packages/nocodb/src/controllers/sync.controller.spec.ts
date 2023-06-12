import { Test } from '@nestjs/testing';
import { SyncService } from '../services/sync.service';
import { SyncController } from './sync.controller';
import type { TestingModule } from '@nestjs/testing';

describe('SyncController', () => {
  let controller: SyncController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [SyncService],
    }).compile();

    controller = module.get<SyncController>(SyncController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
