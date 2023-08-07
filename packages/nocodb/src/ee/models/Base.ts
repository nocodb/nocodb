import BaseCE from 'src/models/Base';
import CryptoJS from 'crypto-js';
import type { BaseType, BoolType } from 'nocodb-sdk';
import NocoCache from '~/cache/NocoCache';
import { CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// todo: hide credentials
export default class Base extends BaseCE implements BaseType {
  is_local?: BoolType;

  protected static castType(base: Base): Base {
    return base && new Base(base);
  }

  public static async createBase(
    base: BaseType & { projectId: string; created_at?; updated_at? },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(base, [
      'id',
      'alias',
      'config',
      'type',
      'is_meta',
      'is_local',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
    ]);
    insertObj.config = CryptoJS.AES.encrypt(
      JSON.stringify(base.config),
      Noco.getConfig()?.auth?.jwt?.secret,
    ).toString();

    const { id } = await ncMeta.metaInsert2(
      base.projectId,
      null,
      MetaTable.BASES,
      insertObj,
    );

    await NocoCache.appendToList(
      CacheScope.BASE,
      [base.projectId],
      `${CacheScope.BASE}:${id}`,
    );

    // call before reorder to update cache
    const returnBase = await this.get(id, ncMeta);

    await this.reorderBases(base.projectId);

    return returnBase;
  }

  public async getConnectionConfig(): Promise<any> {
    if (this.is_meta || this.is_local) {
      const metaConfig = await NcConnectionMgrv2.getDataConfig();
      const config = { ...metaConfig };
      if (config.client === 'sqlite3') {
        config.connection = metaConfig;
      }
      return config;
    }

    const config = this.getConfig();

    // todo: update sql-client args
    if (config?.client === 'sqlite3') {
      config.connection.filename =
        config.connection.filename || config.connection?.connection.filename;
    }

    return config;
  }

  isMeta(_only = false, _mode = 0) {
    if (_only) {
      if (_mode === 0) {
        return this.is_meta;
      }
      return this.is_local;
    } else {
      return this.is_meta || this.is_local;
    }
  }
}
