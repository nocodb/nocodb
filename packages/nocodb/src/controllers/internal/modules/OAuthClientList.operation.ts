import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';

@Injectable()
export class OAuthClientListOperation implements InternalApiModule {
  constructor(protected readonly oAuthClientService: OauthClientService) {}
  operation: 'oAuthClientList';
  httpMethod: 'GET';

  async handle(
    context: NcContext,
    {
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): Promise<InternalApiResponse> {
    return await this.oAuthClientService.listClients(context, req);
  }
}
