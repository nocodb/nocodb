import Noco from '../Noco';
import Project from './Project';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import Model from './Model';
import { BaseType, UITypes } from 'nocodb-sdk';
import NocoCache from '../cache/NocoCache';
import CryptoJS from 'crypto-js';
import { extractProps } from '../meta/helpers/extractProps';
import { NcError } from '../meta/helpers/catchError';
import SyncSource from './SyncSource';

// todo: hide credentials
export default class Base implements BaseType {
  id?: string;
  project_id?: string;
  alias?: string;
  type?: string;
  is_meta?: boolean;
  config?: any;
  created_at?: any;
  updated_at?: any;
  inflection_column?: string;
  inflection_table?: string;
  order?: number;
  enabled?: boolean;

  constructor(base: Partial<Base>) {
    Object.assign(this, base);
  }

  public static async createBase(
    base: BaseType & { projectId: string; created_at?; updated_at? },
    ncMeta = Noco.ncMeta
  ) {
    const insertObj = extractProps(base, [
      'id',
      'alias',
      'config',
      'type',
      'is_meta',
      'created_at',
      'updated_at',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
    ]);
    insertObj.config = CryptoJS.AES.encrypt(
      JSON.stringify(base.config),
      Noco.getConfig()?.auth?.jwt?.secret
    ).toString();

    const { id } = await ncMeta.metaInsert2(
      base.projectId,
      null,
      MetaTable.BASES,
      insertObj
    );

    await NocoCache.appendToList(
      CacheScope.BASE,
      [base.projectId],
      `${CacheScope.BASE}:${id}`
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
      created_at?;
      updated_at?;
    },
    ncMeta = Noco.ncMeta
  ) {
    const oldBase = await Base.get(baseId, ncMeta);

    if (!oldBase) NcError.badRequest('Wrong base id!');

    await NocoCache.deepDel(
      CacheScope.BASE,
      `${CacheScope.BASE}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT
    );

    const updateObj = extractProps(base, [
      'alias',
      'config',
      'type',
      'is_meta',
      'created_at',
      'updated_at',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
    ]);

    if (updateObj.config) {
      updateObj.config = CryptoJS.AES.encrypt(
        JSON.stringify(base.config),
        Noco.getConfig()?.auth?.jwt?.secret
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
      oldBase.id
    );

    await NocoCache.appendToList(
      CacheScope.BASE,
      [base.projectId],
      `${CacheScope.BASE}:${oldBase.id}`
    );

    // call before reorder to update cache
    const returnBase = await this.get(oldBase.id, ncMeta);

    await this.reorderBases(base.projectId, returnBase.id, ncMeta);

    return returnBase;
  }

  static async list(
    args: { projectId: string },
    ncMeta = Noco.ncMeta
  ): Promise<Base[]> {
    let baseDataList = await NocoCache.getList(CacheScope.BASE, [
      args.projectId,
    ]);
    if (!baseDataList.length) {
      baseDataList = await ncMeta.metaList2(
        args.projectId,
        null,
        MetaTable.BASES,
        {
          orderBy: {
            order: 'asc',
          },
        }
      );
      await NocoCache.setList(CacheScope.BASE, [args.projectId], baseDataList);
    }

    baseDataList.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

    return baseDataList?.map((baseData) => {
      return new Base(baseData);
    });
  }

  static async get(id: string, ncMeta = Noco.ncMeta): Promise<Base> {
    let baseData =
      id &&
      (await NocoCache.get(
        `${CacheScope.BASE}:${id}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!baseData) {
      baseData = await ncMeta.metaGet2(null, null, MetaTable.BASES, id);
      await NocoCache.set(`${CacheScope.BASE}:${id}`, baseData);
    }
    return baseData && new Base(baseData);
  }

  static async reorderBases(
    projectId: string,
    keepBase?: string,
    ncMeta = Noco.ncMeta
  ) {
    const bases = await this.list({ projectId: projectId }, ncMeta);

    if (keepBase) {
      const kpBase = bases.splice(
        bases.indexOf(bases.find((base) => base.id === keepBase)),
        1
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
        CacheDelDirection.CHILD_TO_PARENT
      );

      b.order = parseInt(i) + 1;

      await ncMeta.metaUpdate(
        b.project_id,
        null,
        MetaTable.BASES,
        {
          order: b.order,
        },
        b.id
      );

      await NocoCache.appendToList(
        CacheScope.BASE,
        [b.project_id],
        `${CacheScope.BASE}:${b.id}`
      );

      await NocoCache.set(`${CacheScope.BASE}:${b.id}`, b);
    }
  }

  public getConnectionConfig(): any {
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
        Noco.getConfig()?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8)
    );

    // todo: update sql-client args
    if (config?.client === 'sqlite3') {
      config.connection.filename =
        config.connection.filename || config.connection?.connection.filename;
    }

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
      ncMeta
    );

    const relColumns = [];
    const relRank = {
      [UITypes.Lookup]: 1,
      [UITypes.Rollup]: 2,
      [UITypes.ForeignKey]: 3,
      [UITypes.LinkToAnotherRecord]: 4,
    }

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
        CacheDelDirection.CHILD_TO_PARENT
      );
    }

    for (const model of models) {
      await model.delete(ncMeta, true);
    }
    await NocoCache.deepDel(
      CacheScope.BASE,
      `${CacheScope.BASE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT
    );

    const syncSources = await SyncSource.list(this.project_id, this.id, ncMeta);
    for (const syncSource of syncSources) {
      await SyncSource.delete(syncSource.id, ncMeta);
    }

    return await ncMeta.metaDelete(null, null, MetaTable.BASES, this.id);
  }

  async getModels(ncMeta = Noco.ncMeta) {
    return await Model.list(
      { project_id: this.project_id, base_id: this.id },
      ncMeta
    );
  }
}
