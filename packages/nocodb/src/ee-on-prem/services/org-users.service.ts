import { Injectable } from '@nestjs/common';
import { OrgUsersService as OrgUsersServiceCE } from 'src/services/org-users.service';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MailService } from '~/services/mail/mail.service';

@Injectable()
export class OrgUsersService extends OrgUsersServiceCE {
  constructor(
    protected readonly baseUsersService: BaseUsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly mailService: MailService,
  ) {
    super(baseUsersService, appHooksService, mailService);
  }
}
