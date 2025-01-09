import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { extractRolesObj } from 'nocodb-sdk';
import * as ejs from 'ejs';
import { PresignedUrl } from 'src/models';
import type { AppConfig } from '~/interface/config';

import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

import { GlobalGuard } from '~/guards/global/global.guard';
import { NcError } from '~/helpers/catchError';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { NcRequest } from '~/interface/config';

@Controller()
export class AuthController {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {}

  @Post([
    '/auth/user/signup',
    '/api/v1/db/auth/user/signup',
    '/api/v1/auth/user/signup',
    '/api/v2/auth/user/signup',
  ])
  @UseGuards(PublicApiLimiterGuard)
  @HttpCode(200)
  async signup(@Req() req: NcRequest, @Res() res: Response): Promise<any> {
    if (this.config.get('auth', { infer: true }).disableEmailAuth) {
      NcError.forbidden('Email authentication is disabled');
    }
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
    '/api/v2/auth/token/refresh',
  ])
  @UseGuards(PublicApiLimiterGuard)
  @HttpCode(200)
  async refreshToken(
    @Req() req: NcRequest,
    @Res() res: Response,
  ): Promise<any> {
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
    '/api/v2/auth/user/signin',
  ])
  @UseGuards(PublicApiLimiterGuard, AuthGuard('local'))
  @HttpCode(200)
  async signin(@Req() req: NcRequest, @Res() res: Response) {
    if (this.config.get('auth', { infer: true }).disableEmailAuth) {
      NcError.forbidden('Email authentication is disabled');
    }
    await this.setRefreshToken({ req, res });
    res.json(await this.usersService.login(req.user, req));
  }

  @UseGuards(GlobalGuard)
  @Post(['/api/v1/auth/user/signout', '/api/v2/auth/user/signout'])
  @HttpCode(200)
  async signOut(@Req() req: NcRequest, @Res() res: Response): Promise<any> {
    if (!(req as any).isAuthenticated?.()) {
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
  @UseGuards(PublicApiLimiterGuard, AuthGuard('google'))
  async googleSignin(@Req() req: NcRequest, @Res() res: Response) {
    await this.setRefreshToken({ req, res });
    res.json(await this.usersService.login(req.user, req));
  }

  @Get('/auth/google')
  @UseGuards(PublicApiLimiterGuard, AuthGuard('google'))
  googleAuthenticate() {
    // google strategy will take care the request
  }

  @Get([
    '/auth/user/me',
    '/api/v1/db/auth/user/me',
    '/api/v1/auth/user/me',
    '/api/v2/auth/user/me',
  ])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  async me(@Req() req: NcRequest) {
    const user = {
      ...req.user,
      roles: extractRolesObj(req.user.roles),
      workspace_roles: extractRolesObj(req.user.workspace_roles),
      base_roles: extractRolesObj(req.user.base_roles),
    };

    await PresignedUrl.signMetaIconImage(user);

    return user;
  }

  @Post([
    '/user/password/change',
    '/api/v1/db/auth/password/change',
    '/api/v1/auth/password/change',
    '/api/v2/auth/password/change',
  ])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('passwordChange', {
    scope: 'org',
  })
  @HttpCode(200)
  async passwordChange(@Req() req: NcRequest, @Res() res): Promise<any> {
    if (!(req as any).isAuthenticated?.()) {
      NcError.forbidden('Not allowed');
    }

    await this.usersService.passwordChange({
      user: req['user'],
      req,
      body: req.body,
    });

    // set new refresh token
    await this.setRefreshToken({ req, res });

    res.json({ msg: 'Password has been updated successfully' });
  }

  @Post([
    '/auth/password/forgot',
    '/api/v1/db/auth/password/forgot',
    '/api/v1/auth/password/forgot',
    '/api/v2/auth/password/forgot',
  ])
  @UseGuards(PublicApiLimiterGuard)
  @HttpCode(200)
  async passwordForgot(@Req() req: NcRequest): Promise<any> {
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
    '/api/v2/auth/token/validate/:tokenId',
  ])
  @UseGuards(PublicApiLimiterGuard)
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
    '/api/v2/auth/password/reset/:tokenId',
  ])
  @UseGuards(PublicApiLimiterGuard)
  @HttpCode(200)
  async passwordReset(
    @Req() req: NcRequest,
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
    '/api/v2/auth/email/validate/:tokenId',
  ])
  @UseGuards(PublicApiLimiterGuard)
  @HttpCode(200)
  async emailVerification(
    @Req() req: NcRequest,
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
    '/api/v2/db/auth/password/reset/:tokenId',
    '/auth/password/reset/:tokenId',
  ])
  @UseGuards(PublicApiLimiterGuard)
  async renderPasswordReset(
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('tokenId') tokenId: string,
  ): Promise<any> {
    try {
      res.send(
        ejs.render(
          (await import('~/modules/auth/ui/auth/resetPassword')).default,
          {
            ncPublicUrl: process.env.NC_PUBLIC_URL || '',
            token: tokenId,
            baseUrl: `/`,
          },
        ),
      );
    } catch (e) {
      return res.status(400).json({ msg: e.message });
    }
  }

  async setRefreshToken({ res, req }) {
    await this.usersService.setRefreshToken({ res, req });
  }
}
