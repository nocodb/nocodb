import {
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController as AuthControllerCE } from 'src/controllers/auth/auth.controller';
import type { AppConfig } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';

@Controller()
export class AuthController extends AuthControllerCE {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {
    super(usersService, appHooksService, config);
  }

  /* OpenID Connect auth apis */
  /* OpenID Connect APIs */
  @Post('/auth/oidc/genTokenByCode')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('openid'))
  async oidcSignin(@Request() req, @Response() res) {
    await this.setRefreshToken({ req, res });
    res.json({
      ...(await this.usersService.login({
        ...req.user,
        provider: 'openid',
      })),
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
  async redirect(@Request() req, @Response() res) {
    const key = `oidc:${req.query.state}`;
    const state = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
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
  async logoutRedirect(@Request() req, @Response() res) {
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
  @Post(['/api/v1/auth/user/signout'])
  @HttpCode(200)
  async signOut(@Request() req, @Response() res): Promise<any> {
    if (!(req as any).isAuthenticated()) {
      NcError.forbidden('Not allowed');
    }

    const result: Record<string, string> = await this.usersService.signOut({
      req,
      res,
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
  async cognitoSignin(@Request() req, @Response() res) {
    await this.setRefreshToken({ req, res });
    res.json({
      ...(await this.usersService.login({
        ...req.user,
        provider: 'cognito',
      })),
      extra: { ...req.extra },
    });
  }
}
