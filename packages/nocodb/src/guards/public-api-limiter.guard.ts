import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { AppConfig } from '~/interface/config';

@Injectable()
export class PublicApiLimiterGuard extends ThrottlerGuard {
  constructor(
    protected readonly configService: ConfigService<AppConfig>,
    protected readonly reflector: Reflector,
  ) {
    super({}, reflector, configService);
  }

  protected async getThrottlerOptions(context: ExecutionContext) {
    const config = this.configService.get('throttler.public', { infer: true });
    const req = context.switchToHttp().getRequest();

    if (!config) {
      return [{ ttl: 0, limit: 0 }];
    }

    if (this.isCriticalAuthEndpoint(req.path)) {
      return [
        {
          ttl: 60000,
          limit: 5,
          blockDuration: 900000,
        },
      ];
    }

    return [
      {
        ttl: config.ttl * 1000,
        limit: config.max_apis,
        blockDuration: config.block_duration * 1000,
      },
    ];
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (this.isCriticalAuthEndpoint(req.path)) {
      const email = req.body?.email || 'no-email';
      return `auth:${req.ip}:${email.toLowerCase()}`;
    }

    const sharedViewUuid = req.params?.sharedViewUuid || 'no-view';
    return `public-api:${req.ip}:${sharedViewUuid}`;
  }

  private isCriticalAuthEndpoint(path: string): boolean {
    const criticalPaths = [
      '/auth/user/signin',
      '/auth/user/signup',
      '/auth/password/forgot',
      '/auth/password/reset',
      '/auth/token/validate',
    ];

    return criticalPaths.some((criticalPath) => path.includes(criticalPath));
  }

  protected throwThrottlingException(context: ExecutionContext): void {
    throw new ThrottlerException('Too many requests. Please try again later.');
  }
}
