import { Test, TestingModule } from '@nestjs/testing';
import { AuditsController } from './audits.controller';
import { AuditsService } from './audits.service';

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
