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
import { UsersController as UsersControllerCE } from 'src/controllers/users/users.controller';
import type { AppConfig } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import Noco from '~/Noco';

@Controller()
export class UsersController extends UsersControllerCE {
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
  @UseGuards(AuthGuard('openid'))
  async oidcSignin(@Request() req, @Response() res) {
    await this.setRefreshToken({ req, res });
    res.json(this.usersService.login({ ...req.user, provider: 'openid' }));
  }

  @Get('/auth/oidc')
  @UseGuards(AuthGuard('openid'))
  openidAuth() {
    // openid strategy will take care the request
  }

  @Get('/auth/oidc/redirect')
  async redirect(@Request() req, @Response() res) {
    const key = `oidc:${req.query.state}`;
    const state = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!state) {
      NcError.forbidden('Unable to verify authorization request state.');
    }

    res.redirect(
      `https://${state.host}/dashboard?code=${req.query.code}&state=${req.query.state}`,
    );
  }

  @Get('/auth/oidc/logout-redirect')
  async logoutRedirect(@Request() req, @Response() res) {
    const host = req.query.state;

    const url = host
      ? `https://${host}/dashboard/#/signin`
      : '/dashboard/#/signin';

    res.send((await import('./templates/redirect')).default({ url }));
  }

  @UseGuards(GlobalGuard)
  @Post('/api/v1/auth/user/signout')
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
      let callbackURL = req.ncSiteUrl + Noco.getConfig().dashboardPath;
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
}
