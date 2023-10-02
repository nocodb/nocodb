import { UITypes } from 'nocodb-sdk';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import type { BoolType, SourceType } from 'nocodb-sdk';
import type { DB_TYPES } from '~/utils/globals';
import Model from '~/models/Model';
import Base from '~/models/Base';
import SyncSource from '~/models/SyncSource';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';

// todo: hide credentials
export default class Source implements SourceType {
  id?: string;
  base_id?: string;
  alias?: string;
  type?: (typeof DB_TYPES)[number];
  is_meta?: BoolType;
  config?: string;
  inflection_column?: string;
  inflection_table?: string;
  order?: number;
  erd_uuid?: string;
  enabled?: BoolType;
  meta?: any;

  constructor(source: Partial<Source>) {
    Object.assign(this, source);
  }

  protected static castType(source: Source): Source {
    return source && new Source(source);
  }

  public static async createBase(
    source: SourceType & {
      baseId: string;
      created_at?;
      updated_at?;
      meta?: any;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(source, [
      'id',
      'alias',
      'config',
      'type',
      'is_meta',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
      'meta',
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

    await NocoCache.appendToList(
      CacheScope.BASE,
      [source.baseId],
      `${CacheScope.BASE}:${id}`,
    );

    // call before reorder to update cache
    const returnBase = await this.get(id, false, ncMeta);

    await this.reorderBases(source.baseId);

    return returnBase;
  }

  public static async updateBase(
    sourceId: string,
    source: SourceType & {
      baseId: string;
      skipReorder?: boolean;
      meta?: any;
      deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const oldBase = await Source.get(sourceId, false, ncMeta);

    if (!oldBase) NcError.badRequest('Wrong source id!');

    await NocoCache.deepDel(
      CacheScope.BASE,
      `${CacheScope.BASE}:${sourceId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    const updateObj = extractProps(source, [
      'alias',
      'config',
      'type',
      'is_meta',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
      'meta',
      'deleted',
    ]);

    if (updateObj.config) {
      updateObj.config = CryptoJS.AES.encrypt(
        JSON.stringify(source.config),
        Noco.getConfig()?.auth?.jwt?.secret,
      ).toString();
    }

    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // type property is undefined even if not provided
    if (!updateObj.type) {
      updateObj.type = oldBase.type;
    }

    await ncMeta.metaUpdate(
      source.baseId,
      null,
      MetaTable.BASES,
      updateObj,
      oldBase.id,
    );

    await NocoCache.appendToList(
      CacheScope.BASE,
      [source.baseId],
      `${CacheScope.BASE}:${oldBase.id}`,
    );

    // call before reorder to update cache
    const returnBase = await this.get(oldBase.id, false, ncMeta);

    if (!source.skipReorder)
      await this.reorderBases(source.baseId, returnBase.id, ncMeta);

    return returnBase;
  }

  static async list(
    args: { baseId: string },
    ncMeta = Noco.ncMeta,
  ): Promise<Source[]> {
    const cachedList = await NocoCache.getList(CacheScope.BASE, [args.baseId]);
    let { list: baseDataList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !baseDataList.length) {
      baseDataList = await ncMeta.metaList2(
        args.baseId,
        null,
        MetaTable.BASES,
        {
          xcCondition: {
            _or: [
              {
                deleted: {
                  neq: true,
                },
              },
              {
                deleted: {
                  eq: null,
                },
              },
            ],
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      // parse JSON metadata
      for (const source of baseDataList) {
        source.meta = parseMetaProp(source, 'meta');
      }

      await NocoCache.setList(CacheScope.BASE, [args.baseId], baseDataList);
    }

    baseDataList.sort(
      (a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity),
    );

    return baseDataList?.map((baseData) => {
      return this.castType(baseData);
    });
  }

  static async get(
    id: string,
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<Source> {
    let baseData =
      id &&
      (await NocoCache.get(
        `${CacheScope.BASE}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!baseData) {
      baseData = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.BASES,
        id,
        null,
        force
          ? {}
          : {
              _or: [
                {
                  deleted: {
                    neq: true,
                  },
                },
                {
                  deleted: {
                    eq: null,
                  },
                },
              ],
            },
      );

      if (baseData) {
        baseData.meta = parseMetaProp(baseData, 'meta');
      }

      await NocoCache.set(`${CacheScope.BASE}:${id}`, baseData);
    }
    return this.castType(baseData);
  }

  static async getByUUID(uuid: string, ncMeta = Noco.ncMeta) {
    const source = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.BASES,
      {
        erd_uuid: uuid,
      },
      null,
      {
        _or: [
          {
            deleted: {
              neq: true,
            },
          },
          {
            deleted: {
              eq: null,
            },
          },
        ],
      },
    );

    if (!source) return null;

    delete source.config;

    return this.castType(source);
  }

  static async reorderBases(
    baseId: string,
    keepBase?: string,
    ncMeta = Noco.ncMeta,
  ) {
    const sources = await this.list({ baseId: baseId }, ncMeta);

    if (keepBase) {
      const kpBase = sources.splice(
        sources.indexOf(sources.find((source) => source.id === keepBase)),
        1,
      );
      if (kpBase.length) {
        sources.splice(kpBase[0].order - 1, 0, kpBase[0]);
      }
    }

    // update order for sources
    for (const [i, b] of Object.entries(sources)) {
      await NocoCache.deepDel(
        CacheScope.BASE,
        `${CacheScope.BASE}:${b.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );

      b.order = parseInt(i) + 1;

      await ncMeta.metaUpdate(
        b.base_id,
        null,
        MetaTable.BASES,
        {
          order: b.order,
        },
        b.id,
      );

      await NocoCache.appendToList(
        CacheScope.BASE,
        [b.base_id],
        `${CacheScope.BASE}:${b.id}`,
      );

      await NocoCache.set(`${CacheScope.BASE}:${b.id}`, b);
    }
  }

  public async getConnectionConfig(): Promise<any> {
    const config = this.getConfig();

    // todo: update sql-client args
    if (config?.client === 'sqlite3') {
      config.connection.filename =
        config.connection.filename || config.connection?.connection.filename;
    }

    return config;
  }

  public getConfig(): any {
    if (this.is_meta) {
      const metaConfig = Noco.getConfig()?.meta?.db;
      const config = { ...metaConfig };
      if (config.client === 'sqlite3') {
        config.connection = metaConfig;
      }
      return config;
    }

    const config = JSON.parse(
      CryptoJS.AES.decrypt(
        this.config,
        Noco.getConfig()?.auth?.jwt?.secret,
      ).toString(CryptoJS.enc.Utf8),
    );

    return config;
  }

  getProject(ncMeta = Noco.ncMeta): Promise<Base> {
    return Base.get(this.base_id, ncMeta);
  }

  async delete(ncMeta = Noco.ncMeta, { force }: { force?: boolean } = {}) {
    const sources = await Source.list({ baseId: this.base_id }, ncMeta);

    if (sources[0].id === this.id && !force) {
      NcError.badRequest('Cannot delete first source');
    }

    const models = await Model.list(
      {
        source_id: this.id,
        base_id: this.base_id,
      },
      ncMeta,
    );

    const relColumns = [];
    const relRank = {
      [UITypes.Lookup]: 1,
      [UITypes.Rollup]: 2,
      [UITypes.ForeignKey]: 3,
      [UITypes.LinkToAnotherRecord]: 4,
    };

    for (const model of models) {
      for (const col of await model.getColumns(ncMeta)) {
        let colOptionTableName = null;
        let cacheScopeName = null;
        switch (col.uidt) {
          case UITypes.Rollup:
            colOptionTableName = MetaTable.COL_ROLLUP;
            cacheScopeName = CacheScope.COL_ROLLUP;
            break;
          case UITypes.Lookup:
            colOptionTableName = MetaTable.COL_LOOKUP;
            cacheScopeName = CacheScope.COL_LOOKUP;
            break;
          case UITypes.ForeignKey:
          case UITypes.LinkToAnotherRecord:
            colOptionTableName = MetaTable.COL_RELATIONS;
            cacheScopeName = CacheScope.COL_RELATION;
            break;
        }
        if (colOptionTableName && cacheScopeName) {
          relColumns.push({ col, colOptionTableName, cacheScopeName });
        }
      }
    }

    relColumns.sort((a, b) => {
      return relRank[a.col.uidt] - relRank[b.col.uidt];
    });

    for (const relCol of relColumns) {
      await ncMeta.metaDelete(null, null, relCol.colOptionTableName, {
        fk_column_id: relCol.col.id,
      });
      await NocoCache.deepDel(
        relCol.cacheScopeName,
        `${relCol.cacheScopeName}:${relCol.col.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    for (const model of models) {
      await model.delete(ncMeta, true);
    }
    await NocoCache.deepDel(
      CacheScope.BASE,
      `${CacheScope.BASE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    const syncSources = await SyncSource.list(this.base_id, this.id, ncMeta);
    for (const syncSource of syncSources) {
      await SyncSource.delete(syncSource.id, ncMeta);
    }

    await NcConnectionMgrv2.deleteAwait(this);

    return await ncMeta.metaDelete(null, null, MetaTable.BASES, this.id);
  }

  async softDelete(ncMeta = Noco.ncMeta, { force }: { force?: boolean } = {}) {
    const bases = await Base.list({ baseId: this.base_id }, ncMeta);

    if (bases[0].id === this.id && !force) {
      NcError.badRequest('Cannot delete first base');
    }

    await ncMeta.metaUpdate(
      this.base_id,
      null,
      MetaTable.BASES,
      {
        deleted: true,
      },
      this.id,
    );

    await NocoCache.deepDel(
      CacheScope.BASE,
      `${CacheScope.BASE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.del(`${CacheScope.BASE}:${this.id}`);
  }

  async getModels(ncMeta = Noco.ncMeta) {
    return await Model.list(
      { base_id: this.base_id, source_id: this.id },
      ncMeta,
    );
  }

  async shareErd(ncMeta = Noco.ncMeta) {
    if (!this.erd_uuid) {
      const uuid = uuidv4();
      this.erd_uuid = uuid;
      // get existing cache
      const key = `${CacheScope.BASE}:${this.id}`;
      const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
      if (o) {
        // update data
        o.erd_uuid = uuid;
        // set cache
        await NocoCache.set(key, o);
      }
      // set meta
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.BASES,
        {
          erd_uuid: this.erd_uuid,
        },
        this.id,
      );
    }
    return this;
  }

  async disableShareErd(ncMeta = Noco.ncMeta) {
    if (this.erd_uuid) {
      this.erd_uuid = null;
      // get existing cache
      const key = `${CacheScope.BASE}:${this.id}`;
      const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
      if (o) {
        // update data
        o.erd_uuid = null;
        // set cache
        await NocoCache.set(key, o);
      }
      // set meta
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.BASES,
        {
          erd_uuid: this.erd_uuid,
        },
        this.id,
      );
    }
    return this;
  }

  isMeta(_only = false, _mode = 0) {
    if (_only) {
      if (_mode === 0) {
        return this.is_meta;
      }
      return false;
    } else {
      return this.is_meta;
    }
  }
}
