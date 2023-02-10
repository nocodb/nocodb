import { NcConfig } from '../../interface/config';

import debug from 'debug';
import NcMetaIO from '../meta/NcMetaIO';
import { Tele } from 'nc-help';
import { MetaTable } from '../utils/globals';
import ncProjectEnvUpgrader from './ncProjectEnvUpgrader';
import ncProjectEnvUpgrader0011045 from './ncProjectEnvUpgrader0011045';
import ncProjectUpgraderV2_0090000 from './ncProjectUpgraderV2_0090000';
import ncDataTypesUpgrader from './ncDataTypesUpgrader';
import ncProjectRolesUpgrader from './ncProjectRolesUpgrader';
import ncFilterUpgrader from './ncFilterUpgrader';
import ncAttachmentUpgrader from './ncAttachmentUpgrader';
import ncAttachmentUpgrader_0104002 from './ncAttachmentUpgrader_0104002';

const log = debug('nc:version-upgrader');
import boxen from 'boxen';

export interface NcUpgraderCtx {
  ncMeta: NcMetaIO;
}

export default class NcUpgrader {
  private static STORE_KEY = 'NC_CONFIG_MAIN';

  // Todo: transaction
  public static async upgrade(ctx: NcUpgraderCtx): Promise<any> {
    this.log(`upgrade : Started`);

    // upgrader version when upgrade started
    let prevVersion;
    // last successfully applied upgrader version
    let currentVersion;
    // latest available upgrader version
    const latestVersion = process.env.NC_VERSION;

    const NC_VERSIONS: any[] = [
      { name: '0009000', handler: null },
      { name: '0009044', handler: null },
      { name: '0011043', handler: ncProjectEnvUpgrader },
      { name: '0011045', handler: ncProjectEnvUpgrader0011045 },
      { name: '0090000', handler: ncProjectUpgraderV2_0090000 },
      { name: '0098004', handler: ncDataTypesUpgrader },
      { name: '0098005', handler: ncProjectRolesUpgrader },
      { name: '0100002', handler: ncFilterUpgrader },
      { name: '0101002', handler: ncAttachmentUpgrader },
      { name: '0104002', handler: ncAttachmentUpgrader_0104002 },
    ];
    if (
      !(await ctx.ncMeta.knexConnection?.schema?.hasTable?.(MetaTable.STORE))
    ) {
      return;
    }
    this.log(`upgrade : Getting configuration from meta database`);

    const config = await ctx.ncMeta.metaGet('', '', MetaTable.STORE, {
      key: this.STORE_KEY,
    });

    if (config) {
      let configObj: NcConfig;

      try {
        configObj = JSON.parse(config.value);
      } catch (e) {
        this.log(`upgrade : Error parsing config`);
        console.log(
          'Parsing app config from store failed, please verify store config is a valid JSON'
        );
        throw e;
      }

      if (configObj.version !== latestVersion) {
        prevVersion = configObj.version;
        currentVersion = configObj.version;
        for (const version of NC_VERSIONS) {
          // compare current version and old version
          if (version.name <= configObj.version) {
            continue;
          }

          let upgrderCtx: NcUpgraderCtx;
          try {
            upgrderCtx = {
              ...ctx,
              ncMeta: await ctx.ncMeta.startTransaction(),
            };

            this.log(
              `upgrade : Upgrading '%s' => '%s'`,
              configObj.version,
              version.name
            );
            await version?.handler?.(upgrderCtx);

            // update version in meta after each upgrade
            config.version = version.name;
            await upgrderCtx.ncMeta.metaUpdate(
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

            await upgrderCtx.ncMeta.commit();
            currentVersion = version.name;
          } catch (e) {
            await upgrderCtx.ncMeta.rollback(e);
            Tele.emit('evt', {
              evt_type: 'appMigration:failed',
              prev: prevVersion,
              from: currentVersion,
              to: latestVersion,
              msg: e.message,
              err: e?.stack?.split?.('\n').slice(0, 2).join('\n'),
            });
            console.log(
              getUpgradeErrorLog(e, currentVersion, latestVersion, prevVersion)
            );
            throw e;
          }
          // todo: backup data

          if (version.name === latestVersion) {
            break;
          }
        }
        config.version = latestVersion;

        Tele.emit('evt', {
          evt_type: 'appMigration:upgraded',
          prev: prevVersion,
          from: prevVersion,
          to: latestVersion,
        });
      }
    } else {
      this.log(`upgrade : Inserting config to meta database`);
      const configObj: any = {};
      const isOld = (await ctx.ncMeta.projectList())?.length;
      configObj.version = isOld ? '0009000' : latestVersion;
      await ctx.ncMeta.metaInsert('', '', MetaTable.STORE, {
        key: NcUpgrader.STORE_KEY,
        value: JSON.stringify(configObj),
      });
      if (isOld) {
        await this.upgrade(ctx);
      }
    }
  }

  private static log(str, ...args): void {
    log(`${str}`, ...args);
  }
}

function getUpgradeErrorLog(
  e: Error,
  currentVersion: string,
  latestVersion: string,
  prevVersion: string
) {
  const errorTitle = `Migration from ${currentVersion} (old version: ${prevVersion}) to ${latestVersion} failed`;

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
