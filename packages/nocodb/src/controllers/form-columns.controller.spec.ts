import { Test } from '@nestjs/testing';
import { FormColumnsService } from '../services/form-columns.service';
import { FormColumnsController } from './form-columns.controller';
import type { TestingModule } from '@nestjs/testing';

describe('FormColumnsController', () => {
  let controller: FormColumnsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormColumnsController],
      providers: [FormColumnsService],
    }).compile();

    controller = module.get<FormColumnsController>(FormColumnsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
