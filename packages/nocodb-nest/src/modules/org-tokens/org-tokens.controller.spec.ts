import { Test } from '@nestjs/testing';
import { OrgTokensController } from './org-tokens.controller';
import { OrgTokensService } from './org-tokens.service';
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
