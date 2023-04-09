import { Test, TestingModule } from '@nestjs/testing';
import { OrgTokensEeService } from './org-tokens.service';

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
