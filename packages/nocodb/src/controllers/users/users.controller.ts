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

import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';

import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { UsersService } from '~/services/users/users.service';

@Controller()
export class UsersController {
  constructor(
    protected readonly usersService: UsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly config: ConfigService<AppConfig>,
  ) {}
}
