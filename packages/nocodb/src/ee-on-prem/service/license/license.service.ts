import fs from 'fs';
import jwt from 'jsonwebtoken';
import {Injectable, Logger} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { OnModuleInit, OnModuleInit } from '@nestjs/common';

// todo: replace with actual public key and avoid readFileSync since it's blocking and not recommended
const publicKey = fs.readFileSync('./public-key/public.pem');

@Injectable()
export class LicenseService implements OnModuleInit {
  private logger = new Logger('LicenseService');

  private licenseData: {
    type: 'ENTERPRISE' | 'ENTERPRISE_AIR_GAPPED' | 'ENTERPRISE_TRIAL';
    maxWorkspaces: number;
    maxUsersPerWorkspace: number;
    siteUrl: string;
  };

  async onModuleInit(): any {
    const { valid, data, error } = await this.verifyLicense(
      process.env.NC_LICENSE_KEY,
    );

    if (!valid) {
      this.logger.error(error);
      process.exit(1);
    }

    this.licenseData = data;
  }

  constructor() {}

  async verifyLicense(licenseKey: string) {
    if (!licenseKey) {
      return { valid: false, error: 'License key not found' };
    }
    try {
      const decoded = jwt.verify(licenseKey, publicKey, {
        algorithms: ['RS256'],
      });

      // todo: do any additional checks here

      if (data.type === 'trial') {
        const now = new Date();
        const exp = new Date(data.exp * 1000);
        if (now > exp) {
          this.logger.error('Trial expired');
          process.exit(1);
        }
      }

      return { valid: true, data: decoded };
    } catch (error) {
      return { valid: false, error: 'Invalid license key' };
    }
  }

  // verify license every day
  @Cron('0 0 0 * * *')
  async handleCron() {
    //  verify token and check if it's expired if it's trial
    const { valid, error } = await this.verifyLicense(
      process.env.NC_LICENSE_KEY,
    );

    if (!valid) {
      this.logger.error(error);
      process.exit(1);
    }
  }

  getLicenseData() {
    return this.licenseData;
  }
}
