import { Test } from '@nestjs/testing';
import { EnvController } from './env.controller';
import type { TestingModule } from '@nestjs/testing';

describe('EnvController', () => {
  let controller: EnvController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnvController],
    }).compile();

    controller = module.get<EnvController>(EnvController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
