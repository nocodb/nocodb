import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { lastValueFrom, Observable } from 'rxjs';

import type { Request } from 'express';
import type { ExecutionContext } from '@nestjs/common';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import { getApiTokenFromHeader } from '~/helpers';

@Injectable()
export class GlobalGuard extends AuthGuard(['jwt']) {
  constructor(private jwtStrategy: JwtStrategy) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    let result;

    const req = context.switchToHttp().getRequest();

    if (req.headers?.['xc-auth'] || req.cookies?.nc_token) {
      try {
        result = await this.extractBoolVal(super.canActivate(context));
        if (result && req.context) {
          req.context.user = {
            id: req.user.id,
            email: req.user.email,
            email_verified: req.user.email_verified,
          };
        }
      } catch (e) {
        console.log(e);
      }
    }

    if (result) return true;

    if (getApiTokenFromHeader(req)) {
      let canActivate = false;
      try {
        const guard = new (AuthGuard('authtoken'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      // If API token validation failed and we have a Bearer token, try OAuth token validation
      if (
        !canActivate &&
        req.headers?.authorization?.toLowerCase().startsWith('bearer ')
      ) {
        try {
          const oauthGuard = new (AuthGuard('oauth-token'))(context);
          canActivate = await this.extractBoolVal(
            oauthGuard.canActivate(context),
          );
        } catch {}
      }

      if (canActivate) {
        return this.authenticate(req, {
          ...req.user,
          isAuthorized: true,
          roles: req.user.roles,
        });
      }
    } else if (req.headers['xc-shared-base-id']) {
      let canActivate = false;
      try {
        const guard = new (AuthGuard('base-view'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      if (canActivate) {
        return this.authenticate(req, {
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
    req: Request,
    user: any = {
      roles: {
        guest: true,
      },
    },
  ): Promise<any> {
    const u = await this.jwtStrategy.validate(req, user);
    req.user = u;

    if (req.context) {
      req.context.user = {
        id: req.user.id,
        email: req.user.email,
        email_verified: req.user.email_verified,
      };
    }
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
