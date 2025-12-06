import NocoEE from 'src/ee/Noco';
import type { Express } from 'express';
import type http from 'http';
import { Installation } from '~/models';
import { isLicenseServerEnabled } from '~/utils/license';

export default class Noco extends NocoEE {
  static async init(param: any, httpServer: http.Server, server: Express) {
    const res = await super.init(param, httpServer, server);

    // Only initialize license server if NC_LICENSE_SERVER_PRIVATE_KEY is provided
    if (isLicenseServerEnabled()) {
      await Installation.initializeLicenseServer(Noco.ncMeta);
    }

    return res;
  }
}
