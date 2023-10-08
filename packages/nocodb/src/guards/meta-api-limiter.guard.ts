import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

@Injectable()
export class MetaApiLimiterGuard extends ThrottlerGuard {
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    return true;
  }
}
