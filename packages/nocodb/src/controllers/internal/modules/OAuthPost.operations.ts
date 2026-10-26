import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';

@Injectable()
export class OAuthPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected readonly oAuthClientService: OauthClientService,
    protected readonly oAuthTokenService: OauthTokenService,
  ) {}
  operations = [
    'oAuthClientCreate' as const,
    'oAuthClientUpdate' as const,
    'oAuthClientDelete' as const,
    'oAuthAuthorizationRevoke' as const,
    'oAuthAuthorizationUpdate' as const,
    'oAuthClientRegenerateSecret' as const,
  ];
  httpMethod = 'POST' as const;

  // A leaked API token must not widen what a signed-in AI app may call.
  apiTokenBlockedOperations = ['oAuthAuthorizationUpdate' as const];

  async handle(
    context: NcContext,
    {
      req,
      operation,
      payload,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'oAuthClientCreate':
        return await this.oAuthClientService.createClient(
          context,
          payload,
          req,
        );
      case 'oAuthClientUpdate':
        return await this.oAuthClientService.updateClient(context, {
          clientId: req.query.clientId as string,
          body: payload,
          req,
        });
      case 'oAuthClientDelete':
        return await this.oAuthClientService.deleteClient(context, {
          clientId: req.query.clientId as string,
          req,
        });
      case 'oAuthAuthorizationRevoke':
        await this.oAuthTokenService.revokeUserAuthorization(
          req.user.id,
          payload.tokenId,
        );
        return true;
      case 'oAuthAuthorizationUpdate':
        return await this.oAuthTokenService.updateUserAuthorization(
          req.user.id,
          payload.tokenId,
          { tools: payload.tools },
        );
      case 'oAuthClientRegenerateSecret':
        return await this.oAuthClientService.regenerateClientSecret(context, {
          clientId: req.query.clientId as string,
          req,
        });
    }
  }
}
