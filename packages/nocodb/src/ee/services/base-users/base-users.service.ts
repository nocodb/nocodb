import { BaseUsersService as BaseUsersServiceCE } from 'src/services/base-users/base-users.service';
import { Injectable } from '@nestjs/common';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class BaseUsersService extends BaseUsersServiceCE {
  constructor(protected appHooksService: AppHooksService) {
    super(appHooksService);
  }
}
