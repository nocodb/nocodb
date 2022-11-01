import Noco from '../Noco';
import Project from './Project';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import Model from './Model';
import { BaseType } from 'nocodb-sdk';
import NocoCache from '../cache/NocoCache';
import CryptoJS from 'crypto-js';
import { extractProps } from '../meta/helpers/extractProps';
import { NcError } from '../meta/helpers/catchError';

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
    base: BaseType & { id: string; projectId: string; created_at?; updated_at? },
    ncMeta = Noco.ncMeta
  ) {
    const oldBase = await Base.get(baseId, ncMeta);

    if (!oldBase) NcError.badRequest('Wrong base id!');

    await ncMeta.metaDelete(null, null, MetaTable.BASES, {
      id: baseId,
    });

    await NocoCache.deepDel(
      CacheScope.BASE,
      `${CacheScope.BASE}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT
    );

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
    
    if (insertObj.config) {
      insertObj.config = CryptoJS.AES.encrypt(
        JSON.stringify(base.config),
        Noco.getConfig()?.auth?.jwt?.secret
      ).toString();
    }

    // type property is undefined even if not provided
    if (!insertObj.type) {
      insertObj.type = oldBase.type;
    }

    // add missing (not updated) fields
    const finalInsertObj = {
      ...oldBase,
      ...insertObj,
    };

    const { id } = await ncMeta.metaInsert2(
      base.projectId,
      null,
      MetaTable.BASES,
      finalInsertObj
    );

    await NocoCache.appendToList(
      CacheScope.BASE,
      [base.projectId],
      `${CacheScope.BASE}:${id}`
    );

    // call before reorder to update cache
    const returnBase = await this.get(id, ncMeta);

    await this.reorderBases(base.projectId, id, ncMeta);

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

    baseDataList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity)
    );

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

  static async reorderBases(projectId: string, keepBase?: string, ncMeta = Noco.ncMeta) {
    const bases = await this.list({ projectId: projectId }, ncMeta);
    
    if (keepBase) {
      const kpBase = bases.splice(bases.indexOf(bases.find((base) => base.id === keepBase)), 1);
      if (kpBase.length) {
        bases.splice(kpBase[0].order - 1, 0, kpBase[0]);
      }
    }

    // update order for bases
    for (const [i, b] of Object.entries(bases)) {
      await ncMeta.metaDelete(null, null, MetaTable.BASES, {
        id: b.id,
      });
  
      await NocoCache.deepDel(
        CacheScope.BASE,
        `${CacheScope.BASE}:${b.id}`,
        CacheDelDirection.CHILD_TO_PARENT
      );
        
      b.order = parseInt(i) + 1;
  
      const { id } = await ncMeta.metaInsert2(
        b.project_id,
        null,
        MetaTable.BASES,
        b
      );

      await NocoCache.appendToList(
        CacheScope.BASE,
        [b.project_id],
        `${CacheScope.BASE}:${id}`
      );

      await NocoCache.set(`${CacheScope.BASE}:${id}`, b);
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

  async delete(ncMeta = Noco.ncMeta) {
    const bases = await Base.list({ projectId: this.project_id }, ncMeta);

    if (bases[0].id === this.id) NcError.badRequest('Cannot delete first base');

    const models = await Model.list(
      {
        base_id: this.id,
        project_id: this.project_id,
      },
      ncMeta
    );
    for (const model of models) {
      await model.delete(ncMeta);
    }
    await NocoCache.deepDel(
      CacheScope.BASE,
      `${CacheScope.BASE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
    return await ncMeta.metaDelete(null, null, MetaTable.BASES, this.id);
  }

  async getModels(ncMeta = Noco.ncMeta) {
    return await Model.list(
      { project_id: this.project_id, base_id: this.id },
      ncMeta
    );
  }
}
