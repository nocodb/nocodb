import { Test } from '@nestjs/testing';
import { ApiDocsController } from './api-docs.controller';
import { ApiDocsService } from '../../services/api-docs/api-docs.service';
import type { TestingModule } from '@nestjs/testing';

describe('ApiDocsController', () => {
  let controller: ApiDocsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiDocsController],
      providers: [ApiDocsService],
    }).compile();

    controller = module.get<ApiDocsController>(ApiDocsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
