import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import NocoLicense from '~/NocoLicense';

export const LICENSE_FEATURE_KEY = 'license_feature';

@Injectable()
export class LicenseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LicenseInterceptor.name);

  constructor(private reflector: Reflector) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
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
      return next.handle();
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
