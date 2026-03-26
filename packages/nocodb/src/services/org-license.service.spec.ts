import { Test } from '@nestjs/testing';
import { OrgLicenseService } from './org-license.service';
import type { TestingModule } from '@nestjs/testing';

describe('OrgLicenseService', () => {
  let service: OrgLicenseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrgLicenseService],
    }).compile();

    service = module.get<OrgLicenseService>(OrgLicenseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
