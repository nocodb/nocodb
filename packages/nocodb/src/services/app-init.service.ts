import { T } from 'nc-help';
import NocoCache from '../cache/NocoCache';
import { Connection } from '../connection/connection';
import initAdminFromEnv from '../helpers/initAdminFromEnv';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';
import { MetaService } from '../meta/meta.service';
import { User } from '../models';
import Noco from '../Noco';
import getInstance from '../utils/getInstance';
import NcUpgrader from '../version-upgrader/NcUpgrader';
import type { IEventEmitter } from '../modules/event-emitter/event-emitter.interface';
import type { Provider } from '@nestjs/common';

export class AppInitService {
  private readonly config: any;

  constructor(config) {
    this.config = config;
  }

  get appConfig(): any {
    return this.config;
  }
}

export const appInitServiceProvider: Provider = {
  provide: AppInitService,
  // initialize app,
  // 1. init cache
  // 2. init db connection and create if not exist
  // 3. init meta and set to Noco
  // 4. init jwt
  // 5. init plugin manager
  // 6. run upgrader
  useFactory: async (
    connection: Connection,
    metaService: MetaService,
    eventEmitter: IEventEmitter,
  ) => {
    process.env.NC_VERSION = '0107004';

    await NocoCache.init();

    await metaService.init();

    // todo: remove
    // temporary hack
    Noco._ncMeta = metaService;
    Noco.config = connection.config;
    Noco.eventEmitter = eventEmitter;

    // init jwt secret
    await Noco.initJwt();

    // load super admin user from env if env is set
    await initAdminFromEnv(metaService);

    // init plugin manager
    await NcPluginMgrv2.init(Noco.ncMeta);
    await Noco.loadEEState();

    // run upgrader
    await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });

    T.init({
      instance: getInstance,
    });
    T.emit('evt_app_started', await User.count());

    // todo: move app config to app-init service
    return new AppInitService(connection.config);
  },
  inject: [Connection, MetaService, 'IEventEmitter'],
};
