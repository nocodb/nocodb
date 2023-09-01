import {
  Controller,
  Get,
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
    res.json(await this.usersService.login(req.user));
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
}
