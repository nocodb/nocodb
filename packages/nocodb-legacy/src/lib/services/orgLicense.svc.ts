import { NC_LICENSE_KEY } from '../constants';
import { validatePayload } from '../meta/api/helpers';
import Store from '../models/Store';
import Noco from '../Noco';

export async function licenseGet() {
  const license = await Store.get(NC_LICENSE_KEY);

  return { key: license?.value };
}

export async function licenseSet(param: { key: string }) {
  validatePayload('swagger.json#/components/schemas/LicenseReq', param);

  await Store.saveOrUpdate({ value: param.key, key: NC_LICENSE_KEY });
  await Noco.loadEEState();
  return true;
}
