import { Test } from '@nestjs/testing';
import { ViewsService } from '../services/views.service';
import { ViewsController } from './views.controller';
import type { TestingModule } from '@nestjs/testing';

describe('ViewsController', () => {
  let controller: ViewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ViewsController],
      providers: [ViewsService],
    }).compile();

    controller = module.get<ViewsController>(ViewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
