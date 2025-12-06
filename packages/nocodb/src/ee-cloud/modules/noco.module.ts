import { nocoModuleEeMetadata } from 'src/ee/modules/noco.module';
import { Module } from '@nestjs/common';

import { OnPremiseController } from '~/controllers/on-premise.controller';
import { isLicenseServerEnabled } from '~/utils/license';

// Conditionally include OnPremiseController based on NC_LICENSE_SERVER_PRIVATE_KEY
const licenseServerControllers = isLicenseServerEnabled()
  ? [OnPremiseController]
  : [];

export const nocoModuleCloudMetadata = {
  imports: [...nocoModuleEeMetadata.imports],
  providers: [...nocoModuleEeMetadata.providers],
  controllers: [
    // Conditionally include OnPremiseController if NC_LICENSE_SERVER_PRIVATE_KEY is set
    ...licenseServerControllers,

    ...nocoModuleEeMetadata.controllers,
  ],
  exports: [...nocoModuleEeMetadata.exports],
};

@Module(nocoModuleCloudMetadata)
export class NocoModule {}
