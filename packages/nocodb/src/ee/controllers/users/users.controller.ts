import {
  Controller,
  Delete,
  HttpCode,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersController as UsersControllerCE } from 'src/controllers/users/users.controller';
import type { AppConfig } from '~/interface/config';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
export class UsersController extends UsersControllerCE {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {
    super(usersService, appHooksService, config);
  }

  @Delete(['/api/v2/meta/user/delete'])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('deleteAccount', {
    scope: 'org',
  })
  @HttpCode(200)
  async delete(@Request() req, @Response() res, @Query('dry') dry?: string) {
    if (dry && dry === 'true') {
      return res.json(
        await this.usersService.userDryDelete({
          id: req.user.id,
          req,
        }),
      );
    } else {
      res.json(
        await this.usersService.userDelete({
          id: req.user.id,
          req,
        }),
      );
    }
  }
}
