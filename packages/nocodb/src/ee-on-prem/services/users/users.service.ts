import { UsersService as UsersServiceCE } from 'src/services/users/users.service';
import { Injectable } from '@nestjs/common';
import type { NcRequest } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { User } from '~/models';
import { NcError } from '~/helpers/catchError';
import { WorkspacesService } from '~/modules/workspaces/workspaces.service';
import { LicenseService } from '~/services/license/license.service';

@Injectable()
export class UsersService extends UsersServiceCE {
  constructor(
    protected metaService: MetaService,
    protected appHooksService: AppHooksService,
    protected workspaceService: WorkspacesService,
    protected baseService: BasesService,
    protected licenseService: LicenseService,
  ) {
    super(metaService, appHooksService, baseService);
  }

  async registerNewUserIfAllowed({
    avatar,
    display_name,
    user_name,
    email,
    salt,
    password,
    email_verification_token,
    req,
  }: {
    avatar;
    display_name;
    user_name;
    email: string;
    salt: any;
    password;
    email_verification_token;
    req: NcRequest;
  }) {
    if (this.licenseService.isTrial()) {
      const userCount = await User.count();
      // todo: get count from payload
      if (userCount >= 3) {
        NcError.notAllowed('Trial limit reached');
      }
    }
    return super.registerNewUserIfAllowed({
      avatar,
      display_name,
      user_name,
      email,
      salt,
      password,
      email_verification_token,
      req,
    });
  }
}
