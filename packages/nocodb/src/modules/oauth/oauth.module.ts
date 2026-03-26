import { forwardRef, Module } from '@nestjs/common';

import { NocoModule } from '~/modules/noco.module';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OAuthController } from '~/modules/oauth/controllers/oauth.controller';
import { OauthAuthorizationService } from '~/modules/oauth/services/oauth-authorization.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { OauthDiscoveryService } from '~/modules/oauth/services/oauth-discovery.service';
import { OauthDcrService } from '~/modules/oauth/services/oauth-dcr.service';

export const oAuthModuleMetadata = {
  imports: [forwardRef(() => NocoModule)],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [OAuthController] : []),
  ],
  providers: [OauthClientService, OauthAuthorizationService, OauthTokenService, OauthDiscoveryService, OauthDcrService],
  exports: [OauthClientService, OauthTokenService, OauthDiscoveryService, OauthDcrService],
};

@Module(oAuthModuleMetadata)
export class OAuthModule {}
