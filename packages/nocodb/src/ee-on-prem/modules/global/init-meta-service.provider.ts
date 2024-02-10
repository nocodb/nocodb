import { InitMetaServiceProvider as InitMetaServiceProviderCE } from 'src/modules/global/init-meta-service.provider';
import type { Provider } from '@nestjs/common';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { LicenseService } from '~/service/license/license.service';

export const InitMetaServiceProvider: Provider = {
  ...InitMetaServiceProviderCE,
  useFactory: async (
    eventEmitter: IEventEmitter,
    licenseService: LicenseService,
  ) => {
    await licenseService.validateLicense();
    return InitMetaServiceProviderCE.useFactory(eventEmitter);
  },

  inject: ['IEventEmitter', LicenseService],
};
