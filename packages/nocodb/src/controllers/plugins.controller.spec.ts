import { Test } from '@nestjs/testing';
import { PluginsService } from '../services/plugins.service';
import { PluginsController } from './plugins.controller';
import type { TestingModule } from '@nestjs/testing';

describe('PluginsController', () => {
  let controller: PluginsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PluginsController],
      providers: [PluginsService],
    }).compile();

    controller = module.get<PluginsController>(PluginsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
