import {CanActivate, Injectable} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

@Injectable()
export class MetaApiLimiterGuard implements CanActivate {
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    return true;
  }
}
