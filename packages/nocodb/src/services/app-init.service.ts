import { Inject, Injectable } from '@nestjs/common';
import NocoCache from '../cache/NocoCache';
import { Connection } from '../connection/connection';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';
import { MetaService } from '../meta/meta.service';
import Noco from '../Noco';
import NcConfigFactory from '../utils/NcConfigFactory';
import NcUpgrader from '../version-upgrader/NcUpgrader';
import type { IEventEmitter } from '../modules/event-emitter/event-emitter.interface';
import type { Provider } from '@nestjs/common';

@Injectable()
export class AppInitService {}

export const appInitServiceProvider: Provider = {
  provide: AppInitService,
  useFactory: async (
    connection: Connection,
    metaService: MetaService,
    eventEmitter: IEventEmitter,
  ) => {
    process.env.NC_VERSION = '0105004';

    await NocoCache.init();

    await connection.init();

    await NcConfigFactory.metaDbCreateIfNotExist(connection.config);

    await metaService.init();

    // todo: remove
    // temporary hack
    Noco._ncMeta = metaService;
    Noco.config = connection.config;
    Noco.eventEmitter = eventEmitter;

    // init jwt secret
    await Noco.initJwt();

    // init plugin manager
    await NcPluginMgrv2.init(Noco.ncMeta);
    await Noco.loadEEState();

    // run upgrader
    await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });

    // todo: move app config to app-init service
    return new AppInitService();
  },
  inject: [Connection, MetaService, 'IEventEmitter'],
};
