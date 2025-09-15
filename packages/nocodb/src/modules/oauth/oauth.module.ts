import { Module } from '@nestjs/common';

import { NocoModule } from '~/modules/noco.module';

export const oAuthModuleMetadata = {
  imports: [NocoModule],
  controllers: [...(process.env.NC_WORKER_CONTAINER !== 'true' ? [] : [])],
  providers: [],
  exports: [],
};

@Module(oAuthModuleMetadata)
export class OAuthModule {}
