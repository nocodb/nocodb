import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AppConfig } from '~/interface/config';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';

@Controller()
export class SSOAuthController {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {}

  @Get('/sso/:clientId/')
  @UseGuards(PublicApiLimiterGuard)
  async ssoLogin(@Req() req: Request & { extra: any }, @Res() res: Response) {
    // todo: move to service and reuse
    // await this.setRefreshToken({ req, res });
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
  async ssoRedirect(
    @Req() req: Request & { extra: any },
    @Res() res: Response,
  ) {
    const dashboardPath = this.config.get('dashboardPath', {
      infer: true,
    });

    const redirectUrl = `${dashboardPath}?short-token=${req.user['token']}`;

    res.redirect(redirectUrl);
  }
  @Get('/sso/:clientId/redirect')
  @UseGuards(PublicApiLimiterGuard)
  async ssoRedirectGet(
    @Req() req: Request & { extra: any },
    @Res() res: Response,
  ) {
    const dashboardPath = this.config.get('dashboardPath', {
      infer: true,
    });

    const redirectUrl = `${dashboardPath}?short-token=${req.user['token']}`;

    res.redirect(redirectUrl);
  }
}
