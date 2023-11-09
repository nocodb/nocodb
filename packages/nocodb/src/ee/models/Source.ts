import CryptoJS from 'crypto-js';
import SourceCE from 'src/models/Source';
import type { BoolType, SourceType } from 'nocodb-sdk';
import NocoCache from '~/cache/NocoCache';
import { CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { stringifyMetaProp } from '~/utils/modelUtils';

// todo: hide credentials
export default class Source extends SourceCE implements SourceType {
  is_local?: BoolType;
  meta?: any;

  protected static castType(source: Source): Source {
    return source && new Source(source);
  }

  public static async createBase(
    source: SourceType & { baseId: string; created_at?; updated_at? },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(source, [
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
      JSON.stringify(source.config),
      Noco.getConfig()?.auth?.jwt?.secret,
    ).toString();

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const { id } = await ncMeta.metaInsert2(
      source.baseId,
      null,
      MetaTable.BASES,
      insertObj,
    );

    // call before reorder to update cache
    const returnBase = await this.get(id, false, ncMeta);

    await NocoCache.appendToList(
      CacheScope.BASE,
      [source.baseId],
      `${CacheScope.BASE}:${id}`,
    );

    await this.reorderBases(source.baseId);

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
