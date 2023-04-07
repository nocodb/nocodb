import { Test, TestingModule } from '@nestjs/testing';
import { SortsController } from './sorts.controller';
import { SortsService } from './sorts.service';

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
