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

    return this.get(id, ncMeta);
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
        MetaTable.BASES
      );
      await NocoCache.setList(CacheScope.BASE, [args.projectId], baseDataList);
    }
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
