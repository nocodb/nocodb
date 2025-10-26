import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';

@Injectable()
export class OAuthAuthorizationRevokeOperation implements InternalApiModule {
  constructor(protected readonly oAuthTokenService: OauthTokenService) {}
  operation: 'oAuthAuthorizationRevoke';
  httpMethod: 'POST';

  async handle(
    context: NcContext,
    {
      req,
      payload,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): Promise<InternalApiResponse> {
    return await this.oAuthTokenService.revokeUserAuthorization(
      req.user.id,
      payload.tokenId,
    );
  }
}
