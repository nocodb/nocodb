import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';

@Injectable()
export class OAuthAuthorizationListOperation implements InternalApiModule {
  constructor(protected readonly oAuthTokenService: OauthTokenService) {}
  operation: 'oAuthAuthorizationList';
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
    return await this.oAuthTokenService.listUserAuthorizations(req.user.id);
  }
}
