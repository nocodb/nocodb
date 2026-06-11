import { Test } from '@nestjs/testing';
import { GalleriesService } from '../services/galleries.service';
import { GalleriesController } from './galleries.controller';
import type { TestingModule } from '@nestjs/testing';

describe('GalleriesController', () => {
  let controller: GalleriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GalleriesController],
      providers: [GalleriesService],
    }).compile();

    controller = module.get<GalleriesController>(GalleriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
