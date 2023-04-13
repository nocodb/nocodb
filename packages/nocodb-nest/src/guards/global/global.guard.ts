import { Inject, Injectable } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { AuthGuard } from '@nestjs/passport';
import passport from 'passport';
import { lastValueFrom, Observable } from 'rxjs';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import type { ExecutionContext } from '@nestjs/common';

@Injectable()
export class GlobalGuard extends AuthGuard(['jwt']) {
  constructor(private jwtStrategy: JwtStrategy) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    let result;
    try {
      result = await this.extractBoolVal(super.canActivate(context));
    } catch (e) {
      console.log(e);
    }

    const req = context.switchToHttp().getRequest();

    if (result && !req.headers['xc-shared-base-id']) {
      if (
        req.path.indexOf('/user/me') === -1 &&
        req.header('xc-preview') &&
        ['owner', 'creator'].some((role) => req.user.roles?.[role])
      ) {
        return this.authenticate({
          ...req.user,
          isAuthorized: true,
          roles: req.header('xc-preview'),
        });
      }
    }

    if(result) return true;

    if (req.headers['xc-token']) {
      let canActivate = false;
      try {
        const guard = new (AuthGuard('authtoken'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      if (canActivate) {
        return this.authenticate({
          ...req.user,
          isAuthorized: true,
          roles: req.user.roles === 'owner' ? 'owner,creator' : req.user.roles,
        });
      }
    } else if (req.headers['xc-shared-base-id']) {
      let canActivate = false;
      try {
        const guard = new (AuthGuard('base-view'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      if (canActivate) {
        return this.authenticate({
          ...req.user,
          isAuthorized: true,
          isPublicBase: true,
        });
      }
    }

    // If JWT authentication fails, use the fallback strategy to set a default user
    return await this.authenticate(req);
  }

  private async authenticate(
    req: any,
    user: any = {
      roles: {
        guest: true,
      },
    },
  ): Promise<any> {
    const u = this.jwtStrategy.validate(req, user);
    req.user = user;
    return true;
  }

  async extractBoolVal(
    canActivate: boolean | Promise<boolean> | Observable<boolean>,
  ) {
    if (canActivate instanceof Observable) {
      return lastValueFrom(canActivate);
    } else if (
      typeof canActivate === 'boolean' ||
      canActivate instanceof Promise
    ) {
      return canActivate;
    }
  }
}
