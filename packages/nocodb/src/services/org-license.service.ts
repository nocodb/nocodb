import { Injectable } from '@nestjs/common';
import { NC_LICENSE_KEY } from '../constants';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { Store } from '~/models';

@Injectable()
export class OrgLicenseService {
  async licenseGet() {
    const license = await Store.get(NC_LICENSE_KEY);

    return { key: license?.value };
  }

  async licenseSet(param: { key: string }) {
    validatePayload('swagger.json#/components/schemas/LicenseReq', param);

    await Store.saveOrUpdate({ value: param.key, key: NC_LICENSE_KEY });
    await Noco.loadEEState();
    return true;
  }

  async licenseStatus() {
    const license = await Store.get(NC_LICENSE_KEY);
    return {
      ee: Noco.isEE(),
      hasLicense: !!license?.value,
      status: Noco.isEE() ? 'active' : 'none',
    };
  }

  async licenseRefresh(): Promise<{ success: boolean; status?: string }> {
    return { success: false, status: 'not_available' };
  }
}
