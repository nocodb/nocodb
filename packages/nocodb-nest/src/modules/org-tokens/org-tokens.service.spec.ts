import { Test, TestingModule } from '@nestjs/testing';
import { OrgTokensService } from './org-tokens.service';

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
