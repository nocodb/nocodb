import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import { User } from '~/models';
import { MetaService } from '~/meta/meta.service';
import Debug from '~/db/util/Debug';
import { NcError } from '~/helpers/catchError';

const debug = new Debug('nc:sso:short-lived-token-strategy');

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

    if (!user) {
      debug.error('User not found');
      NcError.userNotFound(jwtPayload?.email);
    }

    const result = {
      extra: {
        org_id: jwtPayload.org_id,
        sso_client_id: jwtPayload.sso_client_id,
        sso_client_type: jwtPayload.sso_client_type,
      },
      saml: jwtPayload.saml,
      ...(await User.getWithRoles(req.context, user.id, {
        user,
        baseId: req.ncBaseId,
        workspaceId: req.ncWorkspaceId,
      })),
      provider: jwtPayload.provider ?? undefined,
      isAuthorized: true,
    };

    return result;
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
