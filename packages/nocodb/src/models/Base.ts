import { UITypes } from 'nocodb-sdk';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import type { BaseType, BoolType } from 'nocodb-sdk';
import Model from '~/models/Model';
import Project from '~/models/Project';
import SyncSource from '~/models/SyncSource';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  type DB_TYPES,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// todo: hide credentials
export default class Base implements BaseType {
  id?: string;
  project_id?: string;
  alias?: string;
  type?: (typeof DB_TYPES)[number];
  is_meta?: BoolType;
  config?: string;
  inflection_column?: string;
  inflection_table?: string;
  order?: number;
  erd_uuid?: string;
  enabled?: BoolType;

  constructor(base: Partial<Base>) {
    Object.assign(this, base);
  }

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

  public static async updateBase(
    baseId: string,
    base: BaseType & {
      id: string;
      projectId: string;
      skipReorder?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const oldBase = await Base.get(baseId, ncMeta);

    if (!oldBase) NcError.badRequest('Wrong base id!');

    await NocoCache.deepDel(
      CacheScope.BASE,
      `${CacheScope.BASE}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    const updateObj = extractProps(base, [
      'alias',
      'config',
      'type',
      'is_meta',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
    ]);

    if (updateObj.config) {
      updateObj.config = CryptoJS.AES.encrypt(
        JSON.stringify(base.config),
        Noco.getConfig()?.auth?.jwt?.secret,
      ).toString();
    }

    // type property is undefined even if not provided
    if (!updateObj.type) {
      updateObj.type = oldBase.type;
    }

    await ncMeta.metaUpdate(
      base.projectId,
      null,
      MetaTable.BASES,
      updateObj,
      oldBase.id,
    );

    await NocoCache.appendToList(
      CacheScope.BASE,
      [base.projectId],
      `${CacheScope.BASE}:${oldBase.id}`,
    );

    // call before reorder to update cache
    const returnBase = await this.get(oldBase.id, ncMeta);

    if (!base.skipReorder)
      await this.reorderBases(base.projectId, returnBase.id, ncMeta);

    return returnBase;
  }

  static async list(
    args: { projectId: string },
    ncMeta = Noco.ncMeta,
  ): Promise<Base[]> {
    const cachedList = await NocoCache.getList(CacheScope.BASE, [
      args.projectId,
    ]);
    let { list: baseDataList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !baseDataList.length) {
      baseDataList = await ncMeta.metaList2(
        args.projectId,
        null,
        MetaTable.BASES,
        {
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.BASE, [args.projectId], baseDataList);
    }

    baseDataList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return baseDataList?.map((baseData) => {
      return this.castType(baseData);
    });
  }

  static async get(id: string, ncMeta = Noco.ncMeta): Promise<Base> {
    let baseData =
      id &&
      (await NocoCache.get(
        `${CacheScope.BASE}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!baseData) {
      baseData = await ncMeta.metaGet2(null, null, MetaTable.BASES, id);
      await NocoCache.set(`${CacheScope.BASE}:${id}`, baseData);
    }
    return this.castType(baseData);
  }

  static async getByUUID(uuid: string, ncMeta = Noco.ncMeta) {
    const base = await ncMeta.metaGet2(null, null, MetaTable.BASES, {
      erd_uuid: uuid,
    });

    if (!base) return null;

    delete base.config;

    return this.castType(base);
  }

  static async reorderBases(
    projectId: string,
    keepBase?: string,
    ncMeta = Noco.ncMeta,
  ) {
    const bases = await this.list({ projectId: projectId }, ncMeta);

    if (keepBase) {
      const kpBase = bases.splice(
        bases.indexOf(bases.find((base) => base.id === keepBase)),
        1,
      );
      if (kpBase.length) {
        bases.splice(kpBase[0].order - 1, 0, kpBase[0]);
      }
    }

    // update order for bases
    for (const [i, b] of Object.entries(bases)) {
      await NocoCache.deepDel(
        CacheScope.BASE,
        `${CacheScope.BASE}:${b.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );

      b.order = parseInt(i) + 1;

      await ncMeta.metaUpdate(
        b.project_id,
        null,
        MetaTable.BASES,
        {
          order: b.order,
        },
        b.id,
      );

      await NocoCache.appendToList(
        CacheScope.BASE,
        [b.project_id],
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

  getProject(ncMeta = Noco.ncMeta): Promise<Project> {
    return Project.get(this.project_id, ncMeta);
  }

  async delete(ncMeta = Noco.ncMeta, { force }: { force?: boolean } = {}) {
    const bases = await Base.list({ projectId: this.project_id }, ncMeta);

    if (bases[0].id === this.id && !force) {
      NcError.badRequest('Cannot delete first base');
    }

    const models = await Model.list(
      {
        base_id: this.id,
        project_id: this.project_id,
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

    const syncSources = await SyncSource.list(this.project_id, this.id, ncMeta);
    for (const syncSource of syncSources) {
      await SyncSource.delete(syncSource.id, ncMeta);
    }

    await NcConnectionMgrv2.deleteAwait(this);

    return await ncMeta.metaDelete(null, null, MetaTable.BASES, this.id);
  }

  async getModels(ncMeta = Noco.ncMeta) {
    return await Model.list(
      { project_id: this.project_id, base_id: this.id },
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
