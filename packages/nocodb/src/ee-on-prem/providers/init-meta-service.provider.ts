import { InitMetaServiceProvider as InitMetaServiceProviderCE } from 'src/providers/init-meta-service.provider';
import type { FactoryProvider } from '@nestjs/common';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import type { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

export const InitMetaServiceProvider: FactoryProvider = {
  ...InitMetaServiceProviderCE,
  useFactory: async (
    eventEmitter: IEventEmitter,
    appHooksService: AppHooksService,
  ) => {
    return (
      InitMetaServiceProviderCE as FactoryProvider<MetaService>
    ).useFactory(eventEmitter, appHooksService);
  },

  inject: ['IEventEmitter', AppHooksService],
};
