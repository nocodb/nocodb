import { NcConfig } from '../../../interface/config';

import debug from 'debug';
import NcMetaIO from '../meta/NcMetaIO';
import ncProjectEnvUpgrader from './jobs/ncProjectEnvUpgrader';
import ncProjectEnvUpgrader0011045 from './jobs/ncProjectEnvUpgrader0011045';
import ncProjectUpgraderV2_0090000 from './jobs/ncProjectUpgraderV2_0090000';

const log = debug('nc:upgrader');
import { Tele } from 'nc-help';
export interface NcUpgraderCtx {
  ncMeta: NcMetaIO;
}

export default class NcUpgrader {
  private static STORE_KEY = 'NC_CONFIG_MAIN';

  // Todo: transaction
  public static async upgrade(ctx: NcUpgraderCtx): Promise<any> {
    this.log(`upgrade :`);
    let oldVersion;

    try {
      ctx.ncMeta = await ctx.ncMeta.startTransaction();

      const NC_VERSIONS: any[] = [
        { name: '0009000', handler: null },
        { name: '0009044', handler: null },
        { name: '0011043', handler: ncProjectEnvUpgrader },
        { name: '0011045', handler: ncProjectEnvUpgrader0011045 },
        { name: '0090000', handler: ncProjectUpgraderV2_0090000 }
      ];
      if (!(await ctx.ncMeta.knexConnection?.schema?.hasTable?.('nc_store'))) {
        return;
      }
      this.log(`upgrade : Getting configuration from meta database`);

      const config = await ctx.ncMeta.metaGet('', '', 'nc_store', {
        key: this.STORE_KEY
      });

      if (config) {
        const configObj: NcConfig = JSON.parse(config.value);
        if (configObj.version !== process.env.NC_VERSION) {
          oldVersion = configObj.version;
          for (const version of NC_VERSIONS) {
            // compare current version and old version
            if (version.name > configObj.version) {
              this.log(
                `upgrade : Upgrading '%s' => '%s'`,
                configObj.version,
                version.name
              );
              await version?.handler?.(ctx);

              // update version in meta after each upgrade
              config.version = version.name;
              await ctx.ncMeta.metaUpdate(
                '',
                '',
                'nc_store',
                {
                  value: JSON.stringify(config)
                },
                {
                  key: NcUpgrader.STORE_KEY
                }
              );

              // todo: backup data
            }
            if (version.name === process.env.NC_VERSION) {
              break;
            }
          }
          config.version = process.env.NC_VERSION;
          await ctx.ncMeta.metaInsert('', '', 'nc_store', {
            key: NcUpgrader.STORE_KEY,
            value: JSON.stringify(config)
          });
        }
      } else {
        this.log(`upgrade : Inserting config to meta database`);
        const configObj: any = {};
        const isOld = (await ctx.ncMeta.projectList())?.length;
        configObj.version = isOld ? '0009000' : process.env.NC_VERSION;
        await ctx.ncMeta.metaInsert('', '', 'nc_store', {
          key: NcUpgrader.STORE_KEY,
          value: JSON.stringify(configObj)
        });
        if (isOld) {
          await this.upgrade(ctx);
        }
      }
      await ctx.ncMeta.commit();
      Tele.emit('evt', {
        evt_type: 'appMigration:upgraded',
        from: oldVersion,
        to: process.env.NC_VERSION
      });
    } catch (e) {
      await ctx.ncMeta.rollback(e);
      console.log('Error', e);
      Tele.emit('evt', {
        evt_type: 'appMigration:failed',
        from: oldVersion,
        to: process.env.NC_VERSION,
        msg: e.msg
      });
    }
  }

  private static log(str, ...args): void {
    log(`${str}`, ...args);
  }

  private;
}
