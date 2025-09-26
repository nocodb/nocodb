import { forwardRef, Module } from '@nestjs/common';

import { NocoModule } from '~/modules/noco.module';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OAuthController } from '~/modules/oauth/controllers/oauth.controller';
import { OauthAuthorizationService } from '~/modules/oauth/services/oauth-authorization.service';
import { OauthTokenService } from '~/modules/oauth/services/oauth-token.service';
import { OauthDcrService } from '~/modules/oauth/services/oauth-dcr.service';
import { OauthMetadataService } from '~/modules/oauth/services/oauth-metadata.service';

export const oAuthModuleMetadata = {
  imports: [forwardRef(() => NocoModule)],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [OAuthController] : []),
  ],
  providers: [
    OauthClientService,
    OauthAuthorizationService,
    OauthTokenService,
    OauthDcrService,
    OauthMetadataService,
  ],
  exports: [OauthClientService],
};

@Module(oAuthModuleMetadata)
export class OAuthModule {}
