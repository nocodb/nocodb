import { Module } from '@nestjs/common';

import { oAuthModuleMetadata as oAuthModuleMetadataCE } from 'src/modules/oauth/oauth.module';
import { OauthDcrService } from '~/modules/oauth/services/oauth-dcr.service';
import { OauthMetadataService } from '~/modules/oauth/services/oauth-metadata.service';

export const oAuthModuleMetadata = {
  imports: [...oAuthModuleMetadataCE.imports],
  controllers: [...oAuthModuleMetadataCE.controllers],
  providers: [
    ...oAuthModuleMetadataCE.providers,
    OauthDcrService,
    OauthMetadataService,
  ],
  exports: [...oAuthModuleMetadataCE.exports],
};

@Module(oAuthModuleMetadata)
export class OAuthModule {}
