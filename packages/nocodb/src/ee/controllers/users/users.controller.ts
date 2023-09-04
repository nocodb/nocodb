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

@Controller()
export class UsersController extends UsersControllerCE {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {
    super(usersService, appHooksService, config);
  }
}
