import { forwardRef, Module } from '@nestjs/common';

import { NocoModule } from '~/modules/noco.module';
import { OauthClientService } from '~/modules/oauth/services/oauth-client.service';
import { OAuthController } from '~/modules/oauth/controllers/oauth.controller';

export const oAuthModuleMetadata = {
  imports: [forwardRef(() => NocoModule)],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [OAuthController] : []),
  ],
  providers: [OauthClientService],
  exports: [OauthClientService],
};

@Module(oAuthModuleMetadata)
export class OAuthModule {}
