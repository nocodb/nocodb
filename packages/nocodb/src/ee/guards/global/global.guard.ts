import { Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { extractRolesObj, PlanLimitTypes } from 'nocodb-sdk';
import { lastValueFrom, Observable } from 'rxjs';
import type { Request } from 'express';
import type { ExecutionContext } from '@nestjs/common';
import { checkLimit } from '~/helpers/paymentHelpers';
import { UsageStat } from '~/models';
import { JwtStrategy } from '~/strategies/jwt.strategy';

@Injectable()
export class GlobalGuard extends AuthGuard(['jwt']) {
  private logger = new Logger(GlobalGuard.name);

  constructor(private jwtStrategy: JwtStrategy) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    let result;

    const req = context.switchToHttp().getRequest();

    if (req.headers?.['xc-auth']) {
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
        this.logger.debug(e);
      }
    }

    if (result && !req.headers['xc-shared-base-id']) {
      if (
        req.path.indexOf('/user/me') === -1 &&
        req.header('xc-preview') &&
        ['owner', 'creator'].some((role) => req.user.roles?.[role])
      ) {
        return (req.user = {
          ...req.user,
          isAuthorized: true,
          roles: extractRolesObj(req.header('xc-preview')),
        });
      }
    }

    if (result) return true;

    if (req.headers['xc-token']) {
      let canActivate = false;
      try {
        const guard = new (AuthGuard('authtoken'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      if (canActivate) {
        if (req.ncWorkspace) {
          await checkLimit({
            workspace: req.ncWorkspace,
            type: PlanLimitTypes.LIMIT_API_CALL,
            message: ({ limit }) =>
              `You have reached the limit of ${limit} API calls for your plan.`,
            throwError: req.ncWorkspace?.payment?.plan?.free,
          });

          await UsageStat.incrby(
            req.ncWorkspace.id,
            PlanLimitTypes.LIMIT_API_CALL,
            1,
            req.ncWorkspace?.payment?.subscription?.billing_cycle_anchor ||
              req.ncWorkspace?.created_at,
          );
        }

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
