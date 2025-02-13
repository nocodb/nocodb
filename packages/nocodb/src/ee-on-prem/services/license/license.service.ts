import jwt from 'jsonwebtoken';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

// todo: replace with actual public key and avoid readFileSync since it's blocking and not recommended
// const publicKey = fs.readFileSync('./public-key/public.pem');

const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmvm9e3qSr4r4fgXdbJE6
9Wkk7LQk/QVvpyCT8/kAWtSPRepeeih+CDlS3szWl2EahctBDPcuWjICIfPnaYXs
G/KKTNV2Q5orzzYtIAxa7xqyK7/nGHQMHGsVdbAdlLH53DInzcI6oeRijRhMdTNn
n/Hq1bLjqUQOuL6g8DvY7SV9UolzGtynbURnKpImMZ/N+HCbXX6fCIOxW8rGrTbv
g51Rsk5P27TppQH0oYnyJDfOwvwlvCPN/SO0l7WbnqZTSRlPx3UsLls5RUIx91RL
wgB8qNPFuz/58jGESPXWbWNE/uT34px+QDgoew0nk5ZlCc2Uy90u3UM9SFk9ctE2
fwIDAQAB
-----END PUBLIC KEY-----`;

@Injectable()
export class LicenseService {
  // private logger = new Logger('LicenseService');

  private logger = {
    error: console.error,
    log: console.log,
  };

  private licenseData: {
    type: 'ENTERPRISE' | 'ENTERPRISE_AIR_GAPPED' | 'ENTERPRISE_TRIAL';
    maxWorkspacesPerUser: number;
    maxUsers: number;
    siteUrl: string;
    exp: number;
    iat: number;
    oneWorkspace?: boolean;
    maxWorkspaces?: number;
  };

  private _isExpired: boolean = false;

  get isExpired() {
    return this._isExpired;
  }

  async validateLicense(): Promise<void> {
    const { valid, data, error } = await this.verifyLicense(
      process.env.NC_LICENSE_KEY,
    );

    if (!valid) {
      this.logger.error(error);
      process.exit(1);
    }

    this.licenseData = data as any;
  }

  constructor() {}

  private async verifyLicense(licenseKey: string) {
    if (!licenseKey) {
      return { valid: false, error: 'License key not found' };
    }
    try {
      const data: any = jwt.verify(licenseKey, publicKey, {
        algorithms: ['RS256'],
      });

      // if any of the properties are missing, throw an error
      if (!data || !data.type || !data.siteUrl) {
        throw new Error('Invalid license key');
      }

      return { valid: true, data };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        const data = jwt.decode(licenseKey, { json: true });
        this._isExpired = true;
        return { valid: true, data };
      }

      return { valid: false, error: 'Invalid license key' };
    }
  }

  // verify license every day
  @Cron('0 0 * * * *')
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
    if (!this.licenseData) {
      throw new Error('License not foundO');
    }

    return this.licenseData;
  }

  isTrial() {
    return this.getLicenseData().type === 'ENTERPRISE_TRIAL';
  }

  getSiteUrl() {
    return this.getLicenseData().siteUrl;
  }

  getExpiry() {
    return this.getLicenseData().exp;
  }

  getIssuedTime() {
    return this.getLicenseData().iat;
  }

  getMaxWorkspacePerUser() {
    return this.getLicenseData().maxWorkspacesPerUser || 1;
  }

  getMaxUsers() {
    return this.getLicenseData().maxUsers || 4;
  }

  getOneWorkspace() {
    return this.getLicenseData().oneWorkspace || false;
  }

  getMaxWorkspaces() {
    return (
      +this.getLicenseData().maxWorkspaces ||
      (this.getOneWorkspace() ? 1 : undefined)
    );
  }
}
