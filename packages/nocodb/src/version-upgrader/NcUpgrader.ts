import debug from 'debug';
import boxen from 'boxen';
import ncAttachmentUpgrader from './upgraders/0101002_ncAttachmentUpgrader';
import ncAttachmentUpgrader_0104002 from './upgraders/0104002_ncAttachmentUpgrader';
import ncStickyColumnUpgrader from './upgraders/0105002_ncStickyColumnUpgrader';
import ncFilterUpgrader_0104004 from './upgraders/0104004_ncFilterUpgrader';
import ncFilterUpgrader_0105003 from './upgraders/0105003_ncFilterUpgrader';
import ncFilterUpgrader from './upgraders/0100002_ncFilterUpgrader';
import ncHookUpgrader from './upgraders/0105004_ncHookUpgrader';
import ncProjectConfigUpgrader from './upgraders/0107004_ncProjectConfigUpgrader';
import ncXcdbLTARUpgrader from './upgraders/0108002_ncXcdbLTARUpgrader';
import ncXcdbLTARIndexUpgrader from './upgraders/0111002_ncXcdbLTARIndexUpgrader';
import ncXcdbCreatedAndUpdatedSystemFieldsUpgrader from './upgraders/0111005_ncXcdbCreatedAndUpdatedSystemFieldsUpgrader';
import ncDatasourceDecrypt from './upgraders/0225002_ncDatasourceDecrypt';
import ncDuplicatePluginMerge from './upgraders/0258003_ncDuplicatePluginMerge';
import type { MetaService } from '~/meta/meta.service';
import type { NcConfig } from '~/interface/config';
import { T } from '~/utils';
import { MetaTable, RootScopes } from '~/utils/globals';

const log = debug('nc:version-upgrader');

export interface NcUpgraderCtx {
  ncMeta: MetaService;
}

export default class NcUpgrader {
  protected static STORE_KEY = 'NC_CONFIG_MAIN';

  // Todo: transaction
  public static async upgrade(ctx: NcUpgraderCtx): Promise<any> {
    this.log(`upgrade :`);
    let oldVersion;

    try {
      ctx.ncMeta = await ctx.ncMeta.startTransaction();

      if (
        !(await ctx.ncMeta.knexConnection?.schema?.hasTable?.(MetaTable.STORE))
      ) {
        return;
      }
      this.log(`upgrade : Getting configuration from meta database`);

      const config = await ctx.ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          key: this.STORE_KEY,
        },
      );

      const NC_VERSIONS: any[] = this.getUpgraderList();

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
                version.name,
              );
              await version?.handler?.(ctx);

              // update version in meta after each upgrade
              config.version = version.name;
              await ctx.ncMeta.metaUpdate(
                RootScopes.ROOT,
                RootScopes.ROOT,
                MetaTable.STORE,
                {
                  value: JSON.stringify({ version: config.version }),
                },
                {
                  key: NcUpgrader.STORE_KEY,
                },
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
        const isOld =
          process.env.NC_CLOUD !== 'true' &&
          (await ctx.ncMeta.baseList())?.length;
        configObj.version = isOld ? '0009000' : process.env.NC_VERSION;
        await ctx.ncMeta.metaInsert2(
          RootScopes.ROOT,
          RootScopes.ROOT,
          MetaTable.STORE,
          {
            key: NcUpgrader.STORE_KEY,
            value: JSON.stringify(configObj),
          },
          true,
        );
        if (isOld) {
          await this.upgrade(ctx);
        }
      }
      await ctx.ncMeta.commit();
      T.emit('evt', {
        evt_type: 'appMigration:upgraded',
        from: oldVersion,
        to: process.env.NC_VERSION,
      });
    } catch (e) {
      await ctx.ncMeta.rollback(e);
      T.emit('evt', {
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

  protected static log(str, ...args): void {
    log(`${str}`, ...args);
  }

  protected static getUpgraderList(): {
    name: string;
    handler: (ctx?: NcUpgraderCtx) => Promise<void> | void;
  }[] {
    return [
      { name: '0100002', handler: ncFilterUpgrader },
      { name: '0101002', handler: ncAttachmentUpgrader },
      { name: '0104002', handler: ncAttachmentUpgrader_0104002 },
      { name: '0104004', handler: ncFilterUpgrader_0104004 },
      { name: '0105002', handler: ncStickyColumnUpgrader },
      { name: '0105003', handler: ncFilterUpgrader_0105003 },
      { name: '0105004', handler: ncHookUpgrader },
      { name: '0107004', handler: ncProjectConfigUpgrader },
      { name: '0108002', handler: ncXcdbLTARUpgrader },
      { name: '0111002', handler: ncXcdbLTARIndexUpgrader },
      { name: '0111005', handler: ncXcdbCreatedAndUpdatedSystemFieldsUpgrader },
      { name: '0225002', handler: ncDatasourceDecrypt },
      { name: '0258003', handler: ncDuplicatePluginMerge },
    ];
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
    { title: errorTitle, padding: 1, borderColor: 'yellow' },
  );
}
