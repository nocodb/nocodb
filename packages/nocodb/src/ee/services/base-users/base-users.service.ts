import { BaseUsersService as BaseUsersServiceCE } from 'src/services/base-users/base-users.service';
import { Injectable } from '@nestjs/common';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MailService } from '~/services/mail/mail.service';

@Injectable()
export class BaseUsersService extends BaseUsersServiceCE {
  constructor(
    protected appHooksService: AppHooksService,
    protected readonly mailService: MailService,
  ) {
    super(appHooksService, mailService);
  }
}
