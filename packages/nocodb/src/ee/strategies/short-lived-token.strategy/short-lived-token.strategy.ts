import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import { User } from '~/models';
import { MetaService } from '~/meta/meta.service';
import { sanitiseUserObj } from '~/utils'

@Injectable()
export class ShortLivedTokenStrategy extends PassportStrategy(
  Strategy,
  'short-lived-token',
) {
  constructor(config: Record<any, any>) {
    super({
      ...config,
      jwtFromRequest: ExtractJwt.fromHeader('xc-short-token'),
      passReqToCallback: true,
      expiresIn: '1m',
    });
  }

  async validate(req, jwtPayload) {
    if (!jwtPayload?.email) {
      return jwtPayload;
    }

    const user = await User.getByEmail(jwtPayload?.email);

    return {
      saml: jwtPayload.saml,
      ...(await User.getWithRoles(user.id, {
        user,
        baseId: req.ncBaseId,
        workspaceId: req.ncWorkspaceId,
      })),
      provider: jwtPayload.provider ?? undefined,
      isAuthorized: true,
    };
  }
}

export const ShortLivedTokenStrategyProvider: FactoryProvider = {
  provide: ShortLivedTokenStrategy,
  inject: [MetaService],
  useFactory: async (metaService: MetaService) => {
    const config = metaService.config;

    const options = {
      secretOrKey: config.auth.jwt.secret,
      ...config.auth.jwt.options,
    };

    return new ShortLivedTokenStrategy(options);
  },
};
