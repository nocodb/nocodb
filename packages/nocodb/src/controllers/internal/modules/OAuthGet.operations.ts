import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';

@Injectable()
export class OAuthGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    protected readonly oAuthClientService: OauthClientService,
    protected readonly oAuthTokenService: OauthTokenService,
  ) {}
  operations = [
    'oAuthClientGet' as const,
    'oAuthClientList' as const,
    'oAuthAuthorizationList' as const,
  ];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'oAuthClientGet':
        return await this.oAuthClientService.getClient(context, {
          clientId: req.query.clientId as string,
          req,
        });
      case 'oAuthClientList':
        return await this.oAuthClientService.listClients(context, req);
      case 'oAuthAuthorizationList':
        return await this.oAuthTokenService.listUserAuthorizations(req.user.id);
    }
  }
}
