import { NcConfig } from '../../interface/config';

import debug from 'debug';
import NcMetaIO from '../meta/NcMetaIO';
import { Tele } from 'nc-help';
import { MetaTable } from '../utils/globals'
import ncProjectEnvUpgrader from './handlers/nc_0011043_project_env_upgrader';
import ncProjectEnvUpgrader2 from './handlers/nc_0011045_project_env_upgrader';
import ncProjectV2Upgrader from './handlers/nc_0090000_project_v2_upgrader';
import ncDataTypesUpgrader from './handlers/nc_0098004_data_types_upgrader';
import ncProjectRolesUpgrader from './handlers/nc_0098005_project_roles_upgrader';

const log = debug('nc:version-upgrader');
import boxen from 'boxen';

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
        { name: '0011045', handler: ncProjectEnvUpgrader2 },
        { name: '0090000', handler: ncProjectV2Upgrader },
        { name: '0098004', handler: ncDataTypesUpgrader },
        { name: '0098005', handler: ncProjectRolesUpgrader },
      ];
      if (!(await ctx.ncMeta.knexConnection?.schema?.hasTable?.(MetaTable.STORE))) {
        return;
      }
      this.log(`upgrade : Getting configuration from meta database`);

      const config = await ctx.ncMeta.metaGet('', '', MetaTable.STORE, {
        key: this.STORE_KEY,
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
                MetaTable.STORE,
                {
                  value: JSON.stringify(config),
                },
                {
                  key: NcUpgrader.STORE_KEY,
                }
              );

              // todo: backup data
            }
            if (version.name === process.env.NC_VERSION) {
              break;
            }
          }
          config.version = process.env.NC_VERSION;
        }
      } else {
        this.log(`upgrade : Inserting config to meta database`);
        const configObj: any = {};
        const isOld = (await ctx.ncMeta.projectList())?.length;
        configObj.version = isOld ? '0009000' : process.env.NC_VERSION;
        await ctx.ncMeta.metaInsert('', '', MetaTable.STORE, {
          key: NcUpgrader.STORE_KEY,
          value: JSON.stringify(configObj),
        });
        if (isOld) {
          await this.upgrade(ctx);
        }
      }
      await ctx.ncMeta.commit();
      Tele.emit('evt', {
        evt_type: 'appMigration:upgraded',
        from: oldVersion,
        to: process.env.NC_VERSION,
      });
    } catch (e) {
      await ctx.ncMeta.rollback(e);
      Tele.emit('evt', {
        evt_type: 'appMigration:failed',
        from: oldVersion,
        to: process.env.NC_VERSION,
        msg: e.message,
        err: e?.stack?.split?.('\n').slice(0, 2).join('\n'),
      });
      console.log(getUpgradeErrorLog(e, oldVersion, process.env.NC_VERSION));
      throw e;
    }
  }

  private static log(str, ...args): void {
    log(`${str}`, ...args);
  }
}

function getUpgradeErrorLog(e: Error, oldVersion: string, newVersion: string) {
  const errorTitle = `Migration from ${oldVersion} to ${newVersion} failed`;

  return boxen(
    `Error
-----
${e.stack}


Please raise an issue in our github by using following link : 
https://github.com/nocodb/nocodb/issues/new?labels=Type%3A%20Bug&template=bug_report.md

Or contact us in our Discord community by following link :
https://discord.gg/5RgZmkW ( message @o1lab, @pranavxc or @wingkwong )`,
    { title: errorTitle, padding: 1, borderColor: 'yellow' }
  );
}
