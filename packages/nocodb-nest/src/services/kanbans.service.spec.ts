import { Test } from '@nestjs/testing';
import { KanbansService } from './kanbans.service';
import type { TestingModule } from '@nestjs/testing';

describe('KanbansService', () => {
  let service: KanbansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KanbansService],
    }).compile();

    service = module.get<KanbansService>(KanbansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
