import { NcDebug } from 'nc-gui/utils/debug';
import type { FactoryProvider } from '@nestjs/common';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { T } from '~/utils';
import { populatePluginsForCloud } from '~/utils/cloud/populateCloudPlugins';
import { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import NcUpgrader from '~/version-upgrader/NcUpgrader';
import NocoCache from '~/cache/NocoCache';
import getInstance from '~/utils/getInstance';
import initAdminFromEnv from '~/helpers/initAdminFromEnv';
import { User } from '~/models';
import { NcConfig, prepareEnv } from '~/utils/nc-config';
import { MetaTable, RootScopes } from '~/utils/globals';
import { updateMigrationJobsState } from '~/helpers/migrationJobs';
import { initBaseBehavior } from '~/helpers/initBaseBehaviour';
import initDataSourceEncryption from '~/helpers/initDataSourceEncryption';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

export const InitMetaServiceProvider: FactoryProvider = {
  // initialize app,
  // 1. init cache
  // 2. init db connection and create if not exist
  // 3. init meta and set to Noco
  // 4. init jwt
  // 5. init plugin manager
  // 6. run upgrader
  useFactory: async (
    eventEmitter: IEventEmitter,
    appHooksService: AppHooksService,
  ) => {
    // NC_DATABASE_URL_FILE, DATABASE_URL_FILE, DATABASE_URL, NC_DATABASE_URL to NC_DB
    await prepareEnv();

    const config = await NcConfig.createByEnv();
    NcDebug.log('Config prepared using environment variables');

    // set version
    process.env.NC_VERSION = '0258003';

    // set migration jobs version
    process.env.NC_MIGRATION_JOBS_VERSION = '7';

    // init cache
    await NocoCache.init();
    NcDebug.log('Cache initialized');

    // init meta service
    const metaService = new MetaService(config);

    // check if nc_store exists
    const ncStoreExists = await metaService.knexConnection.schema.hasTable(
      MetaTable.STORE,
    );

    // get instance config
    const instanceConfig = ncStoreExists
      ? await metaService.metaGet(
          RootScopes.ROOT,
          RootScopes.ROOT,
          MetaTable.STORE,
          {
            key: 'NC_CONFIG_MAIN',
          },
        )
      : null;

    // Avoid upgrading directly from versions lower than 0100002 (NC_VERSION)
    if (instanceConfig) {
      const configObj: NcConfig = JSON.parse(instanceConfig.value);

      if (+configObj.version < 100002) {
        throw new Error(
          `You are trying to upgrade from an old version of NocoDB. Please upgrade to 0.207.3 first and then you can upgrade to the latest version.`,
        );
      }
    } else {
      // if bases are present then it is an old version missing the config
      const isOld = (await metaService.baseList())?.length;
      if (isOld) {
        throw new Error(
          `You are trying to upgrade from an old version of NocoDB. Please upgrade to 0.207.3 first and then you can upgrade to the latest version.`,
        );
      }
    }

    await metaService.init();

    NcDebug.log('Meta service initialized');

    // provide meta and config to Noco
    Noco._ncMeta = metaService;
    Noco.appHooksService = appHooksService;
    Noco.config = config;
    Noco.eventEmitter = eventEmitter;

    if (!instanceConfig) {
      NcDebug.log('Inserting instance config');
      // bump to latest version for fresh install
      await updateMigrationJobsState({
        version: process.env.NC_MIGRATION_JOBS_VERSION,
      });
      NcDebug.log('Migration jobs state updated');
    }

    // init jwt secret
    await Noco.initJwt();
    NcDebug.log('JWT initialized');

    // load super admin user from env if env is set
    await initAdminFromEnv(metaService);
    NcDebug.log('Admin user from environment initialized');
    await Noco.loadEEState();

    if (process.env.NC_LICENSE_KEY) {
      try {
        await populatePluginsForCloud({ ncMeta: Noco.ncMeta });
        NcDebug.log('Cloud plugins initialized from env');
      } catch (e) {
        if (process.env.NC_CLOUD === 'true') throw e;
        console.error('Plugin init failed', e?.message);
      }
    }

    NcDebug.log('Upgrader starting');
    // run upgrader
    await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });
    NcDebug.log('Upgrader finished');

    // init plugin manager
    await NcPluginMgrv2.init(Noco.ncMeta);
    NcDebug.log('Plugin manager initialized');

    if (process.env.NC_CLOUD === 'true') {
      await populatePluginsForCloud({ ncMeta: Noco.ncMeta });
    }
    T.init({
      instance: getInstance,
    });
    T.emit('evt_app_started', await User.count());

    // decide base behavior based on env and database permissions
    await initBaseBehavior();
    NcDebug.log('Base behavior initialized');

    // encrypt datasource if secret is set
    await initDataSourceEncryption(metaService);
    NcDebug.log('Datasource encryption initialized');

    return metaService;
  },
  provide: MetaService,
  inject: ['IEventEmitter', AppHooksService],
};
