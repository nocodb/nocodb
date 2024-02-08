import fs from 'fs';
import jwt from 'jsonwebtoken';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { OnModuleInit, OnModuleInit } from '@nestjs/common';

// todo: replace with actual public key and avoid readFileSync since it's blocking and not recommended
const publicKey = fs.readFileSync('./public-key/public.pem');

@Injectable()
export class LicenseService implements OnModuleInit {
  async onModuleInit(): any {
    await this.verifyLicense(process.env.NC_LICENSE_KEY);
  }
  constructor() {} // private readonly configService: ConfigService<AppConfig>

  async verifyLicense(licenseKey: string) {
    if (!licenseKey) {
      console.error('License key not found');
      return { valid: false, error: 'License key not found' };
    }
    try {
      const decoded = jwt.verify(licenseKey, publicKey, {
        algorithms: ['RS256'],
      });
      console.log('License data:', decoded);
      return { valid: true, data: decoded };
    } catch (error) {
      console.error('Invalid license key');
      return { valid: false, error: error.message };
    }
  }

  // verify license every day
  @Cron('0 0 0 * * *')
  async handleCron() {
    //  verify token and check if it's expired if it's trial
    const { valid, data } = await this.verifyLicense(process.env.NC_LICENSE_KEY);

    if(!valid) {
      console.error('Invalid license');
      process.exit(1);
    }

    if(data.type === 'trial') {
      const now = new Date();
      const exp = new Date(data.exp * 1000);
      if(now > exp) {
        console.error('Trial expired');
        process.exit(1);
      }
    }
  }
}
