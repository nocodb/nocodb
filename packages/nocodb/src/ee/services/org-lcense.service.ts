import { Injectable } from '@nestjs/common';
import { OrgLcenseService as OrgLcenseServiceCE } from 'src/services/org-lcense.service';
import NocoLicense from '~/NocoLicense';

@Injectable()
export class OrgLcenseService extends OrgLcenseServiceCE {
  async licenseStatus() {
    const base = await super.licenseStatus();
    return {
      ...base,
      status: NocoLicense.licenseStatus,
    };
  }
}
