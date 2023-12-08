import {
  Body,
  Controller,
  HttpCode,
  Patch,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';

import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { UsersService } from '~/services/users/users.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
export class UsersController {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {}

  @Patch(['/api/v1/user/profile'])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @HttpCode(200)
  async update(@Body() body, @Request() req, @Response() res) {
    res.json(
      await this.usersService.profileUpdate({
        id: req.user.id,
        params: body,
      }),
    );
  }
}
