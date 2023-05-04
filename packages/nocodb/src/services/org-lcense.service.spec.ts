import { Test } from '@nestjs/testing';
import { OrgLcenseService } from './org-lcense.service';
import type { TestingModule } from '@nestjs/testing';

describe('OrgLcenseService', () => {
  let service: OrgLcenseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrgLcenseService],
    }).compile();

    service = module.get<OrgLcenseService>(OrgLcenseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
