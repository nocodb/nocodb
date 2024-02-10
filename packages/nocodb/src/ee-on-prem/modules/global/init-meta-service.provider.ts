import { InitMetaServiceProvider as InitMetaServiceProviderCE } from 'src/modules/global/init-meta-service.provider';
import { LicenseService } from '../../service/license/license.service';
import type { FactoryProvider } from '@nestjs/common';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import type { MetaService } from '~/meta/meta.service';
//  todo: replace `'../../service/license/license.service'` with `'~/service/license/license.service'`
//        after resolving the issue with path aliases
// import { LicenseService } from '~/service/license/license.service';

export const InitMetaServiceProvider: FactoryProvider = {
  ...InitMetaServiceProviderCE,
  useFactory: async (
    eventEmitter: IEventEmitter,
    licenseService: LicenseService,
  ) => {
    await licenseService.validateLicense();
    return (
      InitMetaServiceProviderCE as FactoryProvider<MetaService>
    ).useFactory(eventEmitter);
  },

  inject: ['IEventEmitter', LicenseService],
};
