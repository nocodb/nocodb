import { forwardRef, Module } from '@nestjs/common';

import { NocoModule } from '~/modules/noco.module';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OAuthController } from '~/modules/oauth/controllers/oauth.controller';
import { OauthAuthorizationService } from '~/modules/oauth/services/oauth-authorization.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { OauthDiscoveryService } from '~/modules/oauth/services/oauth-discovery.service';

export const oAuthModuleMetadata = {
  imports: [forwardRef(() => NocoModule)],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [OAuthController] : []),
  ],
  providers: [OauthClientService, OauthAuthorizationService, OauthTokenService, OauthDiscoveryService],
  exports: [OauthClientService, OauthTokenService, OauthDiscoveryService],
};

@Module(oAuthModuleMetadata)
export class OAuthModule {}
