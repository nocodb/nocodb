import { Test } from '@nestjs/testing';
import { ExtensionsService } from '../services/extensions.service';
import { ExtensionsController } from './extensions.controller';
import type { TestingModule } from '@nestjs/testing';

describe('ExtensionsController', () => {
  let controller: ExtensionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExtensionsController],
      providers: [ExtensionsService],
    }).compile();

    controller = module.get<ExtensionsController>(ExtensionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
