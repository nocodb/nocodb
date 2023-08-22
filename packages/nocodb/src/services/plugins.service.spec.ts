import { Test } from '@nestjs/testing';
import { PluginsService } from './plugins.service';
import type { TestingModule } from '@nestjs/testing';

describe('PluginsService', () => {
  let service: PluginsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginsService],
    }).compile();

    service = module.get<PluginsService>(PluginsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
