import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { AppConfig } from '~/interface/config';

@Injectable()
export class DataApiLimiterGuard extends ThrottlerGuard {
  constructor(
    protected readonly configService: ConfigService<AppConfig>,
    protected readonly reflector: Reflector,
  ) {
    super({}, reflector, configService);
  }

  protected async getThrottlerOptions(context: ExecutionContext) {
    const config = this.configService.get('throttler.data', { infer: true });

    if (!config) {
      return [{ ttl: 0, limit: 0 }];
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
    const userId = req.user?.id || 'anonymous';
    const baseId = req.ncBaseId || 'no-base';
    const workspaceId = req.ncWorkspaceId || 'no-workspace';

    return `data-api:${req.ip}:${userId}:${baseId}:${workspaceId}`;
  }

  protected throwThrottlingException(context: ExecutionContext): void {
    throw new ThrottlerException('Too many requests. Please try again later.');
  }
}
