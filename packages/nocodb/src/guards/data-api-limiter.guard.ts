import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

@Injectable()
export class DataApiLimiterGuard {
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    return true;
  }
}
