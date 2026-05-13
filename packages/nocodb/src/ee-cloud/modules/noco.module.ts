import { nocoModuleEeMetadata } from 'src/ee/modules/noco.module';
import { PaymentService as PaymentServiceEE } from 'src/ee/modules/payment/payment.service';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { OnPremiseController } from '~/controllers/on-premise.controller';
import { OnPremLicenseController } from '~/controllers/on-prem-license.controller';
import { GcpMarketplaceController } from '~/controllers/gcp-marketplace.controller';
import { isLicenseServerEnabled } from '~/utils/license';
import { OnPremLicenseService } from '~/services/on-prem-license.service';
import { GcpMarketplaceService } from '~/services/gcp-marketplace.service';
import { GcpProcurementClient } from '~/services/gcp-procurement.client';
import { GcpPubsubListenerService } from '~/services/gcp-pubsub-listener.service';
import { PaymentService } from '~/modules/payment/payment.service';
import { LastActiveInterceptor } from '~/ee-cloud/interceptors/last-active.interceptor';

// Conditionally include OnPremiseController based on NC_LICENSE_SERVER_PRIVATE_KEY
const licenseServerControllers = isLicenseServerEnabled()
  ? [OnPremiseController]
  : [];

// Conditionally include GCP Marketplace based on NC_GCP_MARKETPLACE_PROVIDER_ID
const isGcpMarketplaceEnabled = () =>
  !!process.env.NC_GCP_MARKETPLACE_PROVIDER_ID;

const gcpMarketplaceControllers = isGcpMarketplaceEnabled()
  ? [GcpMarketplaceController]
  : [];

const gcpMarketplaceProviders = isGcpMarketplaceEnabled()
  ? [GcpMarketplaceService, GcpProcurementClient, GcpPubsubListenerService]
  : [];

// Replace EE PaymentService with cloud override that handles on-prem licenses
const cloudProviders = nocoModuleEeMetadata.providers.map((provider) =>
  provider === PaymentServiceEE ? PaymentService : provider,
);

export const nocoModuleCloudMetadata = {
  imports: [...nocoModuleEeMetadata.imports],
  providers: [
    OnPremLicenseService,
    ...gcpMarketplaceProviders,
    ...cloudProviders,
    // Stamps last_active_at on authenticated requests (5-min debounced).
    // Registered as an interceptor — middlewares run before guards, so
    // req.user wouldn't be populated yet.
    { provide: APP_INTERCEPTOR, useClass: LastActiveInterceptor },
  ],
  controllers: [
    // Conditionally include OnPremiseController if NC_LICENSE_SERVER_PRIVATE_KEY is set
    ...licenseServerControllers,

    // Conditionally include GCP Marketplace controller
    ...gcpMarketplaceControllers,

    // Self-serve on-prem license management
    OnPremLicenseController,

    ...nocoModuleEeMetadata.controllers,
  ],
  exports: [OnPremLicenseService, ...nocoModuleEeMetadata.exports],
};

@Module(nocoModuleCloudMetadata)
export class NocoModule {}
