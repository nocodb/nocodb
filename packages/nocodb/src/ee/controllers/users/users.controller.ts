import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersController as UsersControllerCE } from 'src/controllers/users/users.controller';
import type { AppConfig } from '~/interface/config';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

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
