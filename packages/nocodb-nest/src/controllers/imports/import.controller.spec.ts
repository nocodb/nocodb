import { Test } from '@nestjs/testing';
import { ImportService } from '../../services/import.service';
import { ImportController } from './import.controller';
import type { TestingModule } from '@nestjs/testing';

describe('ImportController', () => {
  let controller: ImportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [ImportService],
    }).compile();

    controller = module.get<ImportController>(ImportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
