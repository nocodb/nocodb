import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';

@Injectable()
export class OAuthClientCreateOperation implements InternalApiModule {
  constructor(protected readonly oAuthClientService: OauthClientService) {}
  operation: 'oAuthClientCreate';
  httpMethod: 'POST';

  async handle(
    context: NcContext,
    {
      payload,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): Promise<InternalApiResponse> {
    return await this.oAuthClientService.updateClient(context, {
      clientId: req.query.clientId as string,
      body: payload,
      req,
    });
  }
}
