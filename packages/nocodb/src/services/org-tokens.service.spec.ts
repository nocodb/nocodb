import { Test } from '@nestjs/testing';
import { OrgTokensService } from './org-tokens.service';
import type { TestingModule } from '@nestjs/testing';

describe('OrgTokensService', () => {
  let service: OrgTokensService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrgTokensService],
    }).compile();

    service = module.get<OrgTokensService>(OrgTokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
