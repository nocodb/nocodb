import { Injectable } from '@nestjs/common';
import { OrgLicenseService as OrgLicenseServiceCE } from 'src/services/org-license.service';
import NocoLicense from '~/NocoLicense';

@Injectable()
export class OrgLicenseService extends OrgLicenseServiceCE {
  async licenseStatus() {
    const base = await super.licenseStatus();
    return {
      ...base,
      status: NocoLicense.licenseStatus,
    };
  }
}
