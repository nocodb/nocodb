import { UsersService as UsersServiceEE } from 'src/ee/services/users/users.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from '../license/license.service';
import type { MetaType } from 'nocodb-sdk';
import type { AppConfig, NcRequest } from '~/interface/config';
import { WorkspacesService } from '~/services/workspaces.service';
import { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { User } from '~/models';
import { NcError } from '~/helpers/catchError';
import { IntegrationsService } from '~/services/integrations.service';
import Noco from '~/Noco';
import { MailService } from '~/services/mail/mail.service';
import { TelemetryService } from '~/services/telemetry.service';

@Injectable()
export class UsersService extends UsersServiceEE {
  constructor(
    protected metaService: MetaService,
    protected appHooksService: AppHooksService,
    protected workspaceService: WorkspacesService,
    protected baseService: BasesService,
    protected mailService: MailService,
    protected integrationsService: IntegrationsService,
    protected configService: ConfigService<AppConfig>,
    protected telemetryService: TelemetryService,
    protected licenseService: LicenseService,
  ) {
    super(
      metaService,
      appHooksService,
      workspaceService,
      baseService,
      mailService,
      integrationsService,
      configService,
      telemetryService,
    );
  }

  async registerNewUserIfAllowed(
    {
      avatar,
      display_name,
      user_name,
      email,
      salt,
      password,
      email_verification_token,
      meta,
      req,
      invite_token,
      workspace_invite,
    }: {
      avatar;
      display_name;
      user_name;
      email: string;
      salt: any;
      password;
      email_verification_token;
      meta?: MetaType;
      req: NcRequest;
      invite_token?: string;
      workspace_invite?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
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
    return super.registerNewUserIfAllowed(
      {
        avatar,
        display_name,
        user_name,
        email,
        salt,
        password,
        email_verification_token,
        meta,
        req,
        invite_token,
        workspace_invite,
      },
      ncMeta,
    );
  }
}
