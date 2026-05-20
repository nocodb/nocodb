import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import type { AppConfig, NcRequest } from '~/interface/config';
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
  async ssoLogin(@Req() req: NcRequest & { extra: any }, @Res() res: Response) {
    // Route through setRefreshToken so single-session enforcement applies
    // (rotates token_version + clears prior refresh tokens). Skip when the
    // passport middleware did not populate req.user — the response was
    // already finalized by passport (redirect to IdP).
    if (req.user?.id) {
      await this.usersService.setRefreshToken({ req, res });
    }
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
    @Req() req: NcRequest & { extra: any },
    @Res() res: Response,
  ) {
    const redirectUrl = `${req.dashboardUrl}?short-token=${req.user['token']}`;

    res.redirect(redirectUrl);
  }
  @Get('/sso/:clientId/redirect')
  @UseGuards(PublicApiLimiterGuard)
  async ssoRedirectGet(
    @Req() req: NcRequest & { extra: any },
    @Res() res: Response,
  ) {
    const redirectUrl = `${req.dashboardUrl}?short-token=${req.user['token']}`;

    res.redirect(redirectUrl);
  }
}
