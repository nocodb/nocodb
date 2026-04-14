import { Test } from '@nestjs/testing';
import { OrgLicenseService } from '../services/org-license.service';
import { OrgLicenseController } from './org-license.controller';
import type { TestingModule } from '@nestjs/testing';

describe('OrgLicenseController', () => {
  let controller: OrgLicenseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrgLicenseController],
      providers: [OrgLicenseService],
    }).compile();

    controller = module.get<OrgLicenseController>(OrgLicenseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
