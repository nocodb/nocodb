import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import NocoLicense from '~/NocoLicense';

export const LICENSE_FEATURE_KEY = 'license_feature';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // If license is explicitly suspended/revoked, block EE endpoints
    if (NocoLicense.shouldBlockAccess()) {
      throw new HttpException(
        {
          msg: 'Your license has been suspended. Please contact support.',
          code: 'LICENSE_SUSPENDED',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // If EE features are active (licensed), allow the request
    if (NocoLicense.isEE) {
      return true;
    }

    const feature = this.reflector.get<string>(
      LICENSE_FEATURE_KEY,
      context.getHandler(),
    );

    throw new HttpException(
      {
        msg: feature
          ? `The "${feature}" feature requires an Enterprise license.`
          : 'This feature requires an Enterprise license.',
        code: 'LICENSE_REQUIRED',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
