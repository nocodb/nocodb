import { Test } from '@nestjs/testing';
import { TestController } from './test.controller';
import { TestService } from './test.service';
import type { TestingModule } from '@nestjs/testing';

describe('TestController', () => {
  let controller: TestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
      providers: [TestService],
    }).compile();

    controller = module.get<TestController>(TestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
