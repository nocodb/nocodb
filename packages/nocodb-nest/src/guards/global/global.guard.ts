import { Inject, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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
      result = (await super.canActivate(context)) as boolean;
    } catch (e) {
      console.log(e);
    }
    if (!result) {
      // If JWT authentication fails, use the fallback strategy to set a default user
      const req = context.switchToHttp().getRequest();
      const user = await this.fallbackAuthenticate(req);
      req.user = user;
      return true;
    }
    return true;
  }

  private async fallbackAuthenticate(req: any): Promise<any> {
    return this.jwtStrategy.validate(req, {
      roles: {
        guest: true,
      },
    });
  }
}
