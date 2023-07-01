import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as ejs from 'ejs';
import { GlobalGuard } from '../../guards/global/global.guard';
import { NcError } from '../../helpers/catchError';
import { Acl } from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { User } from '../../models';
import { AppHooksService } from '../../services/app-hooks/app-hooks.service';
import {
  randomTokenString,
  setTokenCookie,
} from '../../services/users/helpers';
import { UsersService } from '../../services/users/users.service';
import extractRolesObj from '../../utils/extractRolesObj';
import NocoCache from '../../cache/NocoCache';
import { CacheGetType } from '../../utils/globals';

@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly appHooksService: AppHooksService,
  ) {}

  @Post([
    '/auth/user/signup',
    '/api/v1/db/auth/user/signup',
    '/api/v1/auth/user/signup',
  ])
  @HttpCode(200)
  async signup(@Request() req: any, @Response() res: any): Promise<any> {
    res.json(
      await this.usersService.signup({
        body: req.body,
        req,
        res,
      }),
    );
  }

  @Post([
    '/auth/token/refresh',
    '/api/v1/db/auth/token/refresh',
    '/api/v1/auth/token/refresh',
  ])
  @HttpCode(200)
  async refreshToken(@Request() req: any, @Response() res: any): Promise<any> {
    res.json(
      await this.usersService.refreshToken({
        body: req.body,
        req,
        res,
      }),
    );
  }

  @Post([
    '/auth/user/signin',
    '/api/v1/db/auth/user/signin',
    '/api/v1/auth/user/signin',
  ])
  @UseGuards(AuthGuard('local'))
  @HttpCode(200)
  async signin(@Request() req, @Response() res) {
    await this.setRefreshToken({ req, res });
    res.json(this.usersService.login(req.user));
  }

  @UseGuards(GlobalGuard)
  @Post('/api/v1/auth/user/signout')
  @HttpCode(200)
  async signOut(@Request() req, @Response() res): Promise<any> {
    if (!(req as any).isAuthenticated()) {
      NcError.forbidden('Not allowed');
    }
    res.json(
      await this.usersService.signOut({
        req,
        res,
      }),
    );
  }

  @Post(`/auth/google/genTokenByCode`)
  @HttpCode(200)
  @UseGuards(AuthGuard('google'))
  async googleSignin(@Request() req, @Response() res) {
    await this.setRefreshToken({ req, res });
    res.json(this.usersService.login(req.user));
  }

  @Get('/auth/google')
  @UseGuards(AuthGuard('google'))
  googleAuthenticate() {
    // google strategy will take care the request
  }

  @Get(['/auth/user/me', '/api/v1/db/auth/user/me', '/api/v1/auth/user/me'])
  @UseGuards(GlobalGuard)
  async me(@Request() req) {
    const user = {
      ...req.user,
      roles: extractRolesObj(req.user.roles),
    };
    return user;
  }

  @Post([
    '/user/password/change',
    '/api/v1/db/auth/password/change',
    '/api/v1/auth/password/change',
  ])
  @UseGuards(GlobalGuard)
  @Acl('passwordChange')
  @HttpCode(200)
  async passwordChange(@Request() req: any): Promise<any> {
    if (!(req as any).isAuthenticated()) {
      NcError.forbidden('Not allowed');
    }

    await this.usersService.passwordChange({
      user: req['user'],
      req,
      body: req.body,
    });

    return { msg: 'Password has been updated successfully' };
  }

  @Post([
    '/auth/password/forgot',
    '/api/v1/db/auth/password/forgot',
    '/api/v1/auth/password/forgot',
  ])
  @HttpCode(200)
  async passwordForgot(@Request() req: any): Promise<any> {
    await this.usersService.passwordForgot({
      siteUrl: (req as any).ncSiteUrl,
      body: req.body,
      req,
    });

    return { msg: 'Please check your email to reset the password' };
  }

  @Post([
    '/auth/token/validate/:tokenId',
    '/api/v1/db/auth/token/validate/:tokenId',
    '/api/v1/auth/token/validate/:tokenId',
  ])
  @HttpCode(200)
  async tokenValidate(@Param('tokenId') tokenId: string): Promise<any> {
    await this.usersService.tokenValidate({
      token: tokenId,
    });
    return { msg: 'Token has been validated successfully' };
  }

  @Post([
    '/auth/password/reset/:tokenId',
    '/api/v1/db/auth/password/reset/:tokenId',
    '/api/v1/auth/password/reset/:tokenId',
  ])
  @HttpCode(200)
  async passwordReset(
    @Request() req: any,
    @Param('tokenId') tokenId: string,
    @Body() body: any,
  ): Promise<any> {
    await this.usersService.passwordReset({
      token: tokenId,
      body: body,
      req,
    });

    return { msg: 'Password has been reset successfully' };
  }

  @Post([
    '/api/v1/db/auth/email/validate/:tokenId',
    '/api/v1/auth/email/validate/:tokenId',
  ])
  @HttpCode(200)
  async emailVerification(
    @Request() req: any,
    @Param('tokenId') tokenId: string,
  ): Promise<any> {
    await this.usersService.emailVerification({
      token: tokenId,
      req,
    });

    return { msg: 'Email has been verified successfully' };
  }

  @Get([
    '/api/v1/db/auth/password/reset/:tokenId',
    '/auth/password/reset/:tokenId',
  ])
  async renderPasswordReset(
    @Request() req: any,
    @Response() res: any,
    @Param('tokenId') tokenId: string,
  ): Promise<any> {
    try {
      res.send(
        ejs.render((await import('./ui/auth/resetPassword')).default, {
          ncPublicUrl: process.env.NC_PUBLIC_URL || '',
          token: JSON.stringify(tokenId),
          baseUrl: `/`,
        }),
      );
    } catch (e) {
      return res.status(400).json({ msg: e.message });
    }
  }

  async setRefreshToken({ res, req }) {
    const userId = req.user?.id;

    if (!userId) return;

    const user = await User.get(userId);

    if (!user) return;

    const refreshToken = randomTokenString();

    if (!user['token_version']) {
      user['token_version'] = randomTokenString();
    }

    await User.update(user.id, {
      refresh_token: refreshToken,
      email: user.email,
      token_version: user['token_version'],
    });
    setTokenCookie(res, refreshToken);
  }

  /* OpenID Connect auth apis */
  /* OpenID Connect APIs */
  @Post('/auth/oidc/genTokenByCode')
  @UseGuards(AuthGuard('openid'))
  async oidcSignin(@Request() req, @Response() res) {
    await this.setRefreshToken({ req, res });
    res.json(this.usersService.login(req.user));
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
