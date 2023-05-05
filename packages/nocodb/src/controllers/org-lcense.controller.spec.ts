import { Test } from '@nestjs/testing';
import { OrgLcenseService } from '../services/org-lcense.service';
import { OrgLcenseController } from './org-lcense.controller';
import type { TestingModule } from '@nestjs/testing';

describe('OrgLcenseController', () => {
  let controller: OrgLcenseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrgLcenseController],
      providers: [OrgLcenseService],
    }).compile();

    controller = module.get<OrgLcenseController>(OrgLcenseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
