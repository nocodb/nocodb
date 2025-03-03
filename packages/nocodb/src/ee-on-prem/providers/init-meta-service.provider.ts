import { InitMetaServiceProvider as InitMetaServiceProviderCE } from 'src/providers/init-meta-service.provider';
import { LicenseService } from '../services/license/license.service';
import type { FactoryProvider } from '@nestjs/common';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import type { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
//  todo: replace `'../../services/license/license.services'` with `'~/services/license/license.services'`
//        after resolving the issue with path aliases
// import { LicenseService } from '~/services/license/license.services';

export const InitMetaServiceProvider: FactoryProvider = {
  ...InitMetaServiceProviderCE,
  useFactory: async (
    eventEmitter: IEventEmitter,
    appHooksService: AppHooksService,
    licenseService: LicenseService,
  ) => {
    await licenseService.validateLicense();
    return (
      InitMetaServiceProviderCE as FactoryProvider<MetaService>
    ).useFactory(eventEmitter, appHooksService);
  },

  inject: ['IEventEmitter', AppHooksService, LicenseService],
};
