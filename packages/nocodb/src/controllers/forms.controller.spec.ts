import { Test } from '@nestjs/testing';
import { FormsService } from '../services/forms.service';
import { FormsController } from './forms.controller';
import type { TestingModule } from '@nestjs/testing';

describe('FormsController', () => {
  let controller: FormsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormsController],
      providers: [FormsService],
    }).compile();

    controller = module.get<FormsController>(FormsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
