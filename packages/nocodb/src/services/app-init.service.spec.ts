import { Test } from '@nestjs/testing';
import { AppInitService } from './app-init.service';
import type { TestingModule } from '@nestjs/testing';

describe('AppInitService', () => {
  let service: AppInitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppInitService],
    }).compile();

    service = module.get<AppInitService>(AppInitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
