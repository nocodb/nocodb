import { Test } from '@nestjs/testing';
import { OrgTokensService } from '../services/org-tokens.service';
import { OrgTokensController } from './org-tokens.controller';
import type { TestingModule } from '@nestjs/testing';

describe('OrgTokensController', () => {
  let controller: OrgTokensController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrgTokensController],
      providers: [OrgTokensService],
    }).compile();

    controller = module.get<OrgTokensController>(OrgTokensController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
