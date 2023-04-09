import { Test, TestingModule } from '@nestjs/testing';
import { KanbansController } from './kanbans.controller';
import { KanbansService } from './kanbans.service';

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
