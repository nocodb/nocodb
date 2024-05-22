import { UsersService as UsersServiceEE } from 'src/ee/services/users/users.service';
import { Injectable } from '@nestjs/common';
import { LicenseService } from '../license/license.service';
import type { NcRequest } from '~/interface/config';
import { WorkspacesService } from '~/services/workspaces.service';
import { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { User } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class UsersService extends UsersServiceEE {
  constructor(
    protected metaService: MetaService,
    protected appHooksService: AppHooksService,
    protected workspaceService: WorkspacesService,
    protected baseService: BasesService,
    protected licenseService: LicenseService,
  ) {
    super(metaService, appHooksService, workspaceService, baseService);
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
      if (userCount >= this.licenseService.getMaxUsers()) {
        if (this.licenseService.isTrial())
          NcError.notAllowed(
            'No of users exceeded for trial. Please upgrade your license.',
          );
        // never going to hit this else block at the moment
        // keeping it for future
        else
          NcError.notAllowed(
            'Number of users allowed in your license exceeded. Please upgrade your license.',
          );
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
