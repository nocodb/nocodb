import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppEvents } from 'nocodb-sdk';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import { User } from '~/models';
import { MetaService } from '~/meta/meta.service';
import Debug from '~/db/util/Debug';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoCache from '~/cache/NocoCache';

// Consumed-marker TTL — must outlive the 1m token expiry so a replay can
// never slip in after the marker lapses but before the JWT itself expires.
const SHORT_TOKEN_CONSUMED_TTL_SECONDS = 300;

const debug = new Debug('nc:sso:short-lived-token-strategy');

@Injectable()
export class ShortLivedTokenStrategy extends PassportStrategy(
  Strategy,
  'short-lived-token',
) {
  constructor(
    config: Record<any, any>,
    private appHooksService: AppHooksService,
  ) {
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

    // Single-use enforcement: a short-lived token can be exchanged exactly
    // once. Atomic claim (SET NX EX) — the first exchange wins; any replay
    // (duplicate exchange call, token leaked via URL in history/proxy logs)
    // is rejected here, BEFORE the controller rotates token_version, so a
    // replay can never invalidate the session issued by the first exchange.
    const tokenHash = createHash('sha256')
      .update(String(req.headers['xc-short-token']))
      .digest('hex');

    const claimed = await NocoCache.setIfNotExist(
      'root',
      `short_token_used:${tokenHash}`,
      '1',
      SHORT_TOKEN_CONSUMED_TTL_SECONDS,
    );

    if (!claimed) {
      debug.error('Short-lived token replay rejected');
      this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
        email: jwtPayload.email,
        provider: jwtPayload.provider ?? 'sso',
        reason: 'Short-lived token already used',
        req,
      });
      NcError.unauthorized('Token already used');
    }

    const user = await User.getByEmail(jwtPayload?.email);

    if (!user) {
      debug.error('User not found');
      this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
        email: jwtPayload.email,
        provider: jwtPayload.provider ?? 'sso',
        reason: 'User not found',
        req,
      });
      NcError.userNotFound(jwtPayload?.email);
    }

    const result = {
      extra: {
        org_id: jwtPayload.org_id,
        workspace_id: jwtPayload.workspace_id,
        sso_client_id: jwtPayload.sso_client_id,
        sso_client_type: jwtPayload.sso_client_type,
        cognito_identity_type: jwtPayload.cognito_identity_type,
        cognito_federation_provider: jwtPayload.cognito_federation_provider,
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
  inject: [MetaService, AppHooksService],
  useFactory: async (
    metaService: MetaService,
    appHooksService: AppHooksService,
  ) => {
    const config = metaService.config;

    const options = {
      secretOrKey: config.auth.jwt.secret,
      ...config.auth.jwt.options,
    };

    return new ShortLivedTokenStrategy(options, appHooksService);
  },
};
