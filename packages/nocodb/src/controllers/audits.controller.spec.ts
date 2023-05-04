import { Test } from '@nestjs/testing';
import { AuditsService } from '../services/audits.service';
import { AuditsController } from './audits.controller';
import type { TestingModule } from '@nestjs/testing';

describe('AuditsController', () => {
  let controller: AuditsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditsController],
      providers: [AuditsService],
    }).compile();

    controller = module.get<AuditsController>(AuditsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
