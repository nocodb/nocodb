import { promisify } from 'util';
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
import {
  AppEvents,
  AuditOperationSubTypes,
  AuditOperationTypes,
} from 'nocodb-sdk';
import { GlobalGuard } from '../../guards/global/global.guard';
import { NcError } from '../../helpers/catchError';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { Audit, User } from '../../models';
import Noco from '../../Noco';
import { AppHooksService } from '../../services/app-hooks/app-hooks.service';
import {
  genJwt,
  randomTokenString,
  setTokenCookie,
} from '../../services/users/helpers';
import { UsersService } from '../../services/users/users.service';
import extractRolesObj from '../../utils/extractRolesObj';

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
  async refreshToken(@Request() req: any, @Request() res: any): Promise<any> {
    return await this.usersService.refreshToken({
      body: req.body,
      req,
      res,
    });
  }

  async successfulSignIn({ user, err, info, req, res, auditDescription }) {
    try {
      if (!user || !user.email) {
        if (err) {
          return res.status(400).send(err);
        }
        if (info) {
          return res.status(400).send(info);
        }
        return res.status(400).send({ msg: 'Your signin has failed' });
      }

      await promisify((req as any).login.bind(req))(user);

      const refreshToken = randomTokenString();

      if (!user.token_version) {
        user.token_version = randomTokenString();
      }

      await User.update(user.id, {
        refresh_token: refreshToken,
        email: user.email,
        token_version: user.token_version,
      });
      setTokenCookie(res, refreshToken);

      this.appHooksService.emit(AppEvents.USER_SIGNIN, {
        user,
        ip: req.clientIp,
        auditDescription,
      });

      res.json({
        token: genJwt(user, Noco.getConfig()),
      } as any);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  @Post([
    '/auth/user/signin',
    '/api/v1/db/auth/user/signin',
    '/api/v1/auth/user/signin',
  ])
  @UseGuards(AuthGuard('local'))
  @HttpCode(200)
  async signin(@Request() req) {
    return this.usersService.login(req.user);
  }

  @Post('/api/v1/auth/user/signout')
  @HttpCode(200)
  async signout(@Request() req, @Response() res): Promise<any> {
    res.json(
      await this.usersService.signout({
        req,
        res,
      }),
    );
  }

  @Post(`/auth/google/genTokenByCode`)
  @HttpCode(200)
  @UseGuards(AuthGuard('google'))
  async googleSignin(@Request() req) {
    return this.usersService.login(req.user);
  }

  @Get('/auth/google')
  @UseGuards(AuthGuard('google'))
  googleAuthenticate(@Request() req) {
    //  this.googleStrategy.authenticate(req, {
    //   scope: ['profile', 'email'],
    //   state: req.query.state,
    //   callbackURL: req.ncSiteUrl + Noco.getConfig().dashboardPath,
    // });
  }

  @Get(['/auth/user/me', '/api/v1/db/auth/user/me', '/api/v1/auth/user/me'])
  @UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
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
  async passwordChange(@Request() req: any, @Body() body: any): Promise<any> {
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
  async passwordForgot(@Request() req: any, @Body() body: any): Promise<any> {
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
}
