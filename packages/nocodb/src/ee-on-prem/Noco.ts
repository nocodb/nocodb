import NocoEE from 'src/ee/Noco';
import type { Express } from 'express';
import type http from 'http';
import NocoLicense from '~/NocoLicense';

export default class Noco extends NocoEE {
  public static domains: Set<string> = new Set();

  static async init(param: any, httpServer: http.Server, server: Express) {
    const res = await super.init(param, httpServer, server);
    // Initialize license system
    await NocoLicense.init();

    return res;
  }
}
