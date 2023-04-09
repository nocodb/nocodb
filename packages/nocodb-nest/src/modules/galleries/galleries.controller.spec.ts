import { Test, TestingModule } from '@nestjs/testing';
import { GalleriesController } from './galleries.controller';
import { GalleriesService } from './galleries.service';

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
