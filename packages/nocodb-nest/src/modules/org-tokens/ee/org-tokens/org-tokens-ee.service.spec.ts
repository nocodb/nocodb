import { Test } from '@nestjs/testing';
import { OrgTokensEeService } from './org-tokens.service';
import type { TestingModule } from '@nestjs/testing';

describe('OrgTokensService', () => {
  let service: OrgTokensEeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrgTokensEeService],
    }).compile();

    service = module.get<OrgTokensEeService>(OrgTokensEeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
