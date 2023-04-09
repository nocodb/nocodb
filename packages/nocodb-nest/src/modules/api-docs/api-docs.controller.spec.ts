import { Test, TestingModule } from '@nestjs/testing';
import { ApiDocsController } from './api-docs.controller';
import { ApiDocsService } from './api-docs.service';

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
