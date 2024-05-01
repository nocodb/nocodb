import { Injectable, Logger } from '@nestjs/common';
import { SSOClientService } from '~/services/sso-client.service';

@Injectable()
export class OrgSSOClientService extends SSOClientService {
  protected logger = new Logger(OrgSSOClientService.name);

  validateDomain(_param: { clientId: string; orgId: string; req: any }) {
    return Promise.resolve(undefined);
  }
}
