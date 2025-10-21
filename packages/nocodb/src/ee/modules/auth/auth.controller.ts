import { createHmac } from 'crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController as AuthControllerCE } from 'src/modules/auth/auth.controller';
import { AppEvents, CloudOrgUserRoles } from 'nocodb-sdk';
import type { UserType } from 'nocodb-sdk';
import type { AppConfig } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, MetaTable } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';
import SSOClient from '~/models/SSOClient';
import { CHATWOOT_IDENTITY_KEY } from '~/utils/nc-config';
import Noco from '~/Noco';
const IS_UPGRADE_ALLOWED_CACHE_KEY = 'nc_upgrade_allowed';

@Controller()
export class AuthController extends AuthControllerCE {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {
    super(usersService, appHooksService, config);
  }

  @Get(['/auth/user/me', '/api/v1/db/auth/user/me', '/api/v1/auth/user/me'])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  async me(@Req() req: NcRequest) {
    const featureFlags: Record<string, boolean> = (
      await Promise.all([
        (async () => {
          const allowedUsers = await NocoCache.get(
            'root',
            IS_UPGRADE_ALLOWED_CACHE_KEY,
            CacheGetType.TYPE_STRING,
          );
          const isAllowed = allowedUsers
            ?.trim?.()
            .split(/\s*,\s*/)
            .includes(req.user?.email);

          if (isAllowed) {
            return 'upgradeOrg';
          }
        })(),
      ])
    )
      .filter((f) => f)
      .reduce((acc, f) => ({ ...acc, [f]: true }), {});

    // TODO: remove this temporary check : if user owner of any org, then add upgradeOrg to featureFlags
    const orgOwners = await NocoCache.get(
      'root',
      `orgOwners`,
      CacheGetType.TYPE_STRING,
    );
    if (!orgOwners) {
      const orgOwners = await Noco.ncMeta.knexConnection
        .select('fk_user_id')
        .from(MetaTable.ORG_USERS)
        .where('roles', CloudOrgUserRoles.OWNER);

      await NocoCache.set(
        'root',
        `orgOwners`,
        orgOwners.map((o) => o.fk_user_id).join(','),
      );
    }

    if (orgOwners?.includes(req.user?.id)) {
      featureFlags.upgradeOrg = true;
    }

    const user = await super.me(req);

    let identity_hash = null;
    if (CHATWOOT_IDENTITY_KEY && user?.id) {
      identity_hash = createHmac('sha256', CHATWOOT_IDENTITY_KEY)
        .update(user.id)
        .digest('hex');
    }

    return {
      ...user,
      identity_hash,
      featureFlags,
    };
  }

  /* OpenID Connect auth apis */

  /* OpenID Connect APIs */
  @Post('/auth/oidc/genTokenByCode')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('openid'))
  async oidcSignin(
    @Req() req: NcRequest & { extra: any },
    @Res() res: Response,
  ) {
    await this.setRefreshToken({ req, res });
    res.json({
      ...(await this.usersService.login(
        {
          ...req.user,
          provider: 'openid',
        },
        req,
      )),
      extra: { ...req.extra },
    });
  }

  @Get('/auth/oidc')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('openid'))
  openidAuth() {
    // openid strategy will take care the request
  }

  @Get('/auth/oidc/redirect')
  @UseGuards(PublicApiLimiterGuard)
  async redirect(@Req() req: NcRequest, @Res() res: Response) {
    const key = `oidc:${req.query.state}`;
    const state = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);
    if (!state) {
      NcError.forbidden('Unable to verify authorization request state.');
    }

    res.redirect(
      `https://${state.host}${this.config.get('dashboardPath', {
        infer: true,
      })}?code=${req.query.code}&state=${req.query.state}${
        state.continueAfterSignIn
          ? `&continueAfterSignIn=${state.continueAfterSignIn}`
          : ''
      }}`,
    );
  }

  @Get('/auth/oidc/logout-redirect')
  @UseGuards(PublicApiLimiterGuard)
  async logoutRedirect(@Req() req: NcRequest, @Res() res: Response) {
    const host = req.query.state;

    const dashboardPath = this.config.get('dashboardPath', {
      infer: true,
    });

    const url = host
      ? `https://${host}${dashboardPath}#/signin?logout=true`
      : `${dashboardPath}#/signin?logout=true`;

    res.send((await import('./templates/redirect')).default({ url }));
  }

  @UseGuards(PublicApiLimiterGuard, GlobalGuard)
  @Post(['/api/v1/auth/user/signout', '/api/v2/auth/user/signout'])
  @HttpCode(200)
  async signOut(@Req() req: NcRequest, @Res() res: Response): Promise<any> {
    const result: Record<string, string> = await this.usersService.signOut({
      req,
      res,
    });

    if (!(req as any).isAuthenticated?.() && !req.user?.['isAuthorized']) {
      return res.json(result);
    }

    this.appHooksService.emit(AppEvents.USER_SIGNOUT, {
      user: req.user as UserType,
      req,
    });

    // todo: check provider as well, if we have multiple ways of login mechanism
    if (process.env.NC_OIDC_LOGOUT_URL) {
      let callbackURL = req.ncSiteUrl + '/auth/oidc/logout-redirect';
      if (process.env.NC_BASE_APP_URL) {
        const url = new URL(req.ncSiteUrl);
        const baseAppUrl = new URL(process.env.NC_BASE_APP_URL);

        if (baseAppUrl.host !== url.host) {
          callbackURL =
            process.env.NC_BASE_APP_URL + '/auth/oidc/logout-redirect';
        }
      }

      const signoutUrl = new URL(process.env.NC_OIDC_LOGOUT_URL);

      signoutUrl.searchParams.append(
        'client_id',
        process.env.NC_OIDC_CLIENT_ID,
      );
      signoutUrl.searchParams.append('logout_uri', callbackURL);

      result.redirect_url = signoutUrl.toString();
    }

    res.json(result);
  }

  /* OpenID Connect auth apis */

  /* OpenID Connect APIs */
  @Post('/auth/cognito')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('cognito'))
  async cognitoSignin(
    @Req() req: NcRequest & { extra: any },
    @Res() res: Response,
  ) {
    await this.setRefreshToken({ req, res });
    res.json({
      ...(await this.usersService.login(
        {
          ...req.user,
          provider: 'cognito',
        },
        req,
      )),
      extra: { ...req.extra },
    });
  }

  @Get('/auth/saml')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('saml'))
  async samlLogin() {}

  @Get('/auth/saml/logout')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('saml'))
  async samlLogout(
    @Req() req: NcRequest & { extra: any },
    @Res() res: Response,
  ) {
    (req as any).logout(req, function (err, request) {
      if (!err) {
        //redirect to the IdP Logout URL
        res.redirect(request);
      }
    });
  }

  @Post('/auth/saml/redirect')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('saml'))
  async samlLoginCallback(
    @Req() req: NcRequest & { extra: any },
    @Res() res: Response,
  ) {
    const dashboardPath = this.config.get('dashboardPath', {
      infer: true,
    });

    const redirectUrl = `${dashboardPath}?short-token=${req.user['token']}`;

    res.redirect(redirectUrl);
  }

  @Post('/auth/long-lived-token')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('short-lived-token'))
  async longLivedTokenRefresh(
    @Req() req: NcRequest & { extra: any },
    @Res() res: Response,
  ) {
    await this.setRefreshToken({ req, res });
    const result = {
      ...(await this.usersService.login(
        {
          ...req.user,
        },
        req,
      )),
      extra: { ...req.extra },
    };

    res.json(result);
  }

  @Post([
    '/auth/user/signup',
    '/api/v1/db/auth/user/signup',
    '/api/v1/auth/user/signup',
    '/api/v2/auth/user/signup',
  ])
  @UseGuards(PublicApiLimiterGuard)
  @HttpCode(200)
  async signup(@Req() req: NcRequest, @Res() res: Response): Promise<any> {
    // check if any sso clients are present
    if (process.env.NC_CLOUD !== 'true') {
      const ssoClients = await SSOClient.getPublicList({
        ncSiteUrl: req.ncSiteUrl,
      });
      if (ssoClients.length > 0) {
        NcError.forbidden('Email-password authentication is disabled');
      }
    }

    return super.signup(req, res);
  }

  @Post(['/api/v2/auth/password/set'])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @HttpCode(200)
  async setPassword(
    @Req() req: NcRequest,
    @Body() body: { password: string },
  ): Promise<{ msg: string }> {
    await this.usersService.setPassword({
      userId: req.user.id,
      password: body.password,
    });

    return { msg: 'Password set successfully' };
  }
}
