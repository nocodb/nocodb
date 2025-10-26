import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';

@Injectable()
export class OAuthGetOperations implements InternalApiModule {
  constructor(
    protected readonly oAuthClientService: OauthClientService,
    protected readonly oAuthTokenService: OauthTokenService,
  ) {}
  operations: ['oAuthClientGet', 'oAuthClientList', 'oAuthAuthorizationList'];
  httpMethod: 'GET';

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
  ): Promise<InternalApiResponse> {
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
