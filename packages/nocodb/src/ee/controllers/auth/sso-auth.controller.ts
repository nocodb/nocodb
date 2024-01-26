import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthController as AuthControllerCE } from 'src/controllers/auth/auth.controller';
import type { AppConfig } from '~/interface/config';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';


@Controller()
export class SSOAuthController extends AuthControllerCE {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {
    super(usersService, appHooksService, config);
  }

  @Get('/sso/:clientId/')
  @UseGuards(PublicApiLimiterGuard)
  async longLivedTokenRefresh(
    @Req() req: Request & { extra: any },
    @Res() res: Response,
  ) {
    await this.setRefreshToken({ req, res });
    res.json({
      ...(await this.usersService.login(
        {
          ...req.user,
          provider: 'saml',
        },
        req,
      )),
      extra: { ...req.extra },
    });
  }

  @Post('/sso/:clientId/redirect')
  @UseGuards(PublicApiLimiterGuard)
  async longLivedTokenRefresh1(
    @Req() req: Request & { extra: any },
    @Res() res: Response,
  ) {
    await this.setRefreshToken({ req, res });
    res.json({
      ...(await this.usersService.login(
        {
          ...req.user,
          provider: 'saml',
        },
        req,
      )),
      extra: { ...req.extra },
    });
  }
  @Post('/sso/:clientId/redirect')
  @UseGuards(PublicApiLimiterGuard)
  async longLivedTokenRefresh2(
    @Req() req: Request & { extra: any },
    @Res() res: Response,
  ) {
    await this.setRefreshToken({ req, res });
    res.json({
      ...(await this.usersService.login(
        {
          ...req.user,
          provider: 'saml',
        },
        req,
      )),
      extra: { ...req.extra },
    });
  }
}
