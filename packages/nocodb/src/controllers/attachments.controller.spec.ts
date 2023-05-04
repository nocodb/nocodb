import { Test } from '@nestjs/testing';
import { AttachmentsService } from '../services/attachments.service';
import { AttachmentsController } from './attachments.controller';
import type { TestingModule } from '@nestjs/testing';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [AttachmentsService],
    }).compile();

    controller = module.get<AttachmentsController>(AttachmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
