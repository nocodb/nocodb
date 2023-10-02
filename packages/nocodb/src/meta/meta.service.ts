import { Injectable, Optional } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { Knex } from 'knex';
import type * as knex from 'knex';
import XcMigrationSource from '~/meta/migrations/XcMigrationSource';
import XcMigrationSourcev2 from '~/meta/migrations/XcMigrationSourcev2';
import { XKnex } from '~/db/CustomKnex';
import { NcConfig } from '~/utils/nc-config';
import { MetaTable } from '~/utils/globals';
dayjs.extend(utc);
dayjs.extend(timezone);

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

// todo: tobe fixed
const META_TABLES = [];

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

@Injectable()
export class MetaService {
  private _knex: knex.Knex;
  private _config: any;

  constructor(config: NcConfig, @Optional() trx = null) {
    this._config = config;
    this._knex = XKnex({
      ...this._config.meta.db,
      useNullAsDefault: true,
    });
    this.trx = trx;
  }

  get knexInstance(): knex.Knex {
    return this._knex;
  }

  get config(): NcConfig {
    return this._config;
  }

  public get connection() {
    return this.trx ?? this.knexInstance;
  }

  get knexConnection() {
    return this.connection;
  }

  public get knex(): any {
    return this.knexConnection;
  }

  public async metaGet(
    base_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    // xcCondition?
  ): Promise<any> {
    const query = this.connection(target);

    // if (xcCondition) {
    //   query.condition(xcCondition);
    // }

    if (fields?.length) {
      query.select(...fields);
    }

    if (base_id !== null && base_id !== undefined) {
      query.where('base_id', base_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }

    if (!idOrCondition) {
      return query.first();
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else {
      query.where(idOrCondition);
    }

    // console.log(query.toQuery())

    return query.first();
  }

  public async metaInsert2(
    base_id: string,
    source_id: string,
    target: string,
    data: any,
    ignoreIdGeneration?: boolean,
  ): Promise<any> {
    const insertObj = {
      ...data,
      ...(ignoreIdGeneration
        ? {}
        : { id: data?.id || (await this.genNanoid(target)) }),
    };
    if (source_id !== null) insertObj.source_id = source_id;
    if (base_id !== null) insertObj.base_id = base_id;

    await this.knexConnection(target).insert({
      ...insertObj,
      created_at: this.now(),
      updated_at: this.now(),
    });
    return insertObj;
  }

  public async bulkMetaInsert(
    base_id: string,
    source_id: string,
    target: string,
    data: any[],
    ignoreIdGeneration?: boolean,
  ): Promise<any> {
    const insertObj = [];
    const at = this.now();
    for (const d of data) {
      const id = d?.id || (await this.genNanoid(target));
      const tempObj = {
        ...d,
        ...(ignoreIdGeneration ? {} : { id }),
        created_at: at,
        updated_at: at,
      };
      if (source_id !== null) tempObj.source_id = source_id;
      if (base_id !== null) tempObj.base_id = base_id;
      insertObj.push(tempObj);
    }

    await this.knexConnection.batchInsert(target, insertObj);

    return insertObj;
  }

  public async genNanoid(target: string) {
    let prefix;
    switch (target) {
      case MetaTable.PROJECT:
        prefix = 'p';
        break;
      case MetaTable.BASES:
        prefix = 'b';
        break;
      case MetaTable.MODELS:
        prefix = 'm';
        break;
      case MetaTable.COLUMNS:
        prefix = 'c';
        break;
      case MetaTable.COL_RELATIONS:
        prefix = 'l';
        break;
      case MetaTable.COL_SELECT_OPTIONS:
        prefix = 's';
        break;
      case MetaTable.COL_LOOKUP:
        prefix = 'lk';
        break;
      case MetaTable.COL_ROLLUP:
        prefix = 'rl';
        break;
      case MetaTable.COL_FORMULA:
        prefix = 'f';
        break;
      case MetaTable.FILTER_EXP:
        prefix = 'fi';
        break;
      case MetaTable.SORT:
        prefix = 'so';
        break;
      case MetaTable.SHARED_VIEWS:
        prefix = 'sv';
        break;
      case MetaTable.ACL:
        prefix = 'ac';
        break;
      case MetaTable.FORM_VIEW:
        prefix = 'fv';
        break;
      case MetaTable.FORM_VIEW_COLUMNS:
        prefix = 'fvc';
        break;
      case MetaTable.GALLERY_VIEW:
        prefix = 'gv';
        break;
      case MetaTable.GALLERY_VIEW_COLUMNS:
        prefix = 'gvc';
        break;
      case MetaTable.KANBAN_VIEW:
        prefix = 'kv';
        break;
      case MetaTable.KANBAN_VIEW_COLUMNS:
        prefix = 'kvc';
        break;
      case MetaTable.USERS:
        prefix = 'us';
        break;
      case MetaTable.ORGS:
        prefix = 'org';
        break;
      case MetaTable.TEAMS:
        prefix = 'tm';
        break;
      case MetaTable.VIEWS:
        prefix = 'vw';
        break;
      case MetaTable.HOOKS:
        prefix = 'hk';
        break;
      case MetaTable.HOOK_LOGS:
        prefix = 'hkl';
        break;
      case MetaTable.AUDIT:
        prefix = 'adt';
        break;
      case MetaTable.API_TOKENS:
        prefix = 'tkn';
        break;
      default:
        prefix = 'nc';
        break;
    }

    // using nanoid to avoid collision with existing ids when duplicating
    return `${prefix}${nanoidv2()}`;
  }

  public async metaPaginatedList(
    baseId: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [key: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?;
      fields?: string[];
      sort?: { field: string; desc?: boolean };
    },
  ): Promise<{ list: any[]; count: number }> {
    const query = this.knexConnection(target);
    const countQuery = this.knexConnection(target);
    if (baseId !== null && baseId !== undefined) {
      query.where('base_id', baseId);
      countQuery.where('base_id', baseId);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
      countQuery.where('db_alias', dbAlias);
    }

    if (args?.condition) {
      query.where(args.condition);
      countQuery.where(args.condition);
    }
    if (args?.limit) {
      query.limit(args.limit);
    }
    if (args?.sort) {
      query.orderBy(args.sort.field, args.sort.desc ? 'desc' : 'asc');
    }
    if (args?.offset) {
      query.offset(args.offset);
    }
    if (args?.xcCondition) {
      (query as any)
        .condition(args.xcCondition)(countQuery as any)
        .condition(args.xcCondition);
    }

    if (args?.fields?.length) {
      query.select(...args.fields);
    }

    return {
      list: await query,
      count: Object.values(await countQuery.count().first())?.[0] as any,
    };
  }

  // private connection: XKnex;
  // todo: need to fix
  private trx: Knex.Transaction;

  // constructor(app: Noco, config: NcConfig, trx = null) {
  //   super(app, config);
  //
  //   if (this.config?.meta?.db) {
  //     this.connection = trx || XKnex(this.config?.meta?.db);
  //   } else {
  //     let dbIndex = this.config.envs?.[this.config.workingEnv]?.db.findIndex(
  //       (c) => c.meta.dbAlias === this.config?.auth?.jwt?.dbAlias
  //     );
  //     dbIndex = dbIndex === -1 ? 0 : dbIndex;
  //     this.connection = XKnex(
  //       this.config.envs?.[this.config.workingEnv]?.db[dbIndex] as any
  //     );
  //   }
  //   this.trx = trx;
  //   NcConnectionMgr.setXcMeta(this);
  // }

  // public get knexConnection(): XKnex {
  //   return (this.trx || this.connection) as any;
  // }

  // public updateKnex(connectionConfig): void {
  //   this.connection = XKnex(connectionConfig);
  // }

  // public async metaInit(): Promise<boolean> {
  //   await this.connection.migrate.latest({
  //     migrationSource: new XcMigrationSource(),
  //     tableName: 'xc_knex_migrations',
  //   });
  //   await this.connection.migrate.latest({
  //     migrationSource: new XcMigrationSourcev2(),
  //     tableName: 'xc_knex_migrationsv2',
  //   });
  //   return true;
  // }

  public async metaDelete(
    base_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    xcCondition?,
  ): Promise<void> {
    const query = this.knexConnection(target);

    if (base_id !== null && base_id !== undefined) {
      query.where('base_id', base_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else if (idOrCondition) {
      query.where(idOrCondition);
    }

    if (xcCondition) {
      query.condition(xcCondition, {});
    }

    return query.del();
  }

  public async metaGet2(
    base_id: string,
    sourceId: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    xcCondition?,
  ): Promise<any> {
    const query = this.knexConnection(target);

    if (xcCondition) {
      query.condition(xcCondition);
    }

    if (fields?.length) {
      query.select(...fields);
    }

    if (base_id !== null && base_id !== undefined) {
      query.where('base_id', base_id);
    }
    if (sourceId !== null && sourceId !== undefined) {
      query.where('source_id', sourceId);
    }

    if (!idOrCondition) {
      return query.first();
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else {
      query.where(idOrCondition);
    }
    return query.first();
  }

  public async metaGetNextOrder(
    target: string,
    condition: { [key: string]: any },
  ): Promise<number> {
    const query = this.knexConnection(target);

    query.where(condition);
    query.max('order', { as: 'order' });

    return (+(await query.first())?.order || 0) + 1;
  }

  public async metaInsert(
    base_id: string,
    dbAlias: string,
    target: string,
    data: any,
  ): Promise<any> {
    return this.knexConnection(target).insert({
      db_alias: dbAlias,
      base_id,
      ...data,
      created_at: this.now(),
      updated_at: this.now(),
    });
  }

  public async metaList(
    base_id: string,
    _dbAlias: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?;
      fields?: string[];
      orderBy?: { [key: string]: 'asc' | 'desc' };
    },
  ): Promise<any[]> {
    const query = this.knexConnection(target);

    if (base_id !== null && base_id !== undefined) {
      query.where('base_id', base_id);
    }
    /*    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }*/

    if (args?.condition) {
      query.where(args.condition);
    }
    if (args?.limit) {
      query.limit(args.limit);
    }
    if (args?.offset) {
      query.offset(args.offset);
    }
    if (args?.xcCondition) {
      (query as any).condition(args.xcCondition);
    }

    if (args?.orderBy) {
      for (const [col, dir] of Object.entries(args.orderBy)) {
        query.orderBy(col, dir);
      }
    }
    if (args?.fields?.length) {
      query.select(...args.fields);
    }

    return query;
  }

  public async metaList2(
    base_id: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?;
      fields?: string[];
      orderBy?: { [key: string]: 'asc' | 'desc' };
    },
  ): Promise<any[]> {
    const query = this.knexConnection(target);

    if (base_id !== null && base_id !== undefined) {
      query.where('base_id', base_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('source_id', dbAlias);
    }

    if (args?.condition) {
      query.where(args.condition);
    }
    if (args?.limit) {
      query.limit(args.limit);
    }
    if (args?.offset) {
      query.offset(args.offset);
    }
    if (args?.xcCondition) {
      (query as any).condition(args.xcCondition);
    }

    if (args?.orderBy) {
      for (const [col, dir] of Object.entries(args.orderBy)) {
        query.orderBy(col, dir);
      }
    }
    if (args?.fields?.length) {
      query.select(...args.fields);
    }

    return query;
  }

  public async metaCount(
    base_id: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      xcCondition?;
      aggField?: string;
    },
  ): Promise<number> {
    const query = this.knexConnection(target);

    if (base_id !== null && base_id !== undefined) {
      query.where('base_id', base_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('source_id', dbAlias);
    }

    if (args?.condition) {
      query.where(args.condition);
    }

    if (args?.xcCondition) {
      (query as any).condition(args.xcCondition);
    }

    query.count(args?.aggField || 'id', { as: 'count' }).first();

    return +(await query)?.['count'] || 0;
  }

  public async metaUpdate(
    base_id: string,
    dbAlias: string,
    target: string,
    data: any,
    idOrCondition?: string | { [p: string]: any },
    xcCondition?,
  ): Promise<any> {
    const query = this.knexConnection(target);
    if (base_id !== null && base_id !== undefined) {
      query.where('base_id', base_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }

    delete data.created_at;

    query.update({ ...data, updated_at: this.now() });
    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else if (idOrCondition) {
      query.where(idOrCondition);
    }
    if (xcCondition) {
      query.condition(xcCondition);
    }

    return await query;
  }

  public async metaDeleteAll(
    _project_id: string,
    _dbAlias: string,
  ): Promise<void> {
    // await this.knexConnection..dropTableIfExists('nc_roles').;
    // await this.knexConnection.schema.dropTableIfExists('nc_store').;
    // await this.knexConnection.schema.dropTableIfExists('nc_hooks').;
    // await this.knexConnection.schema.dropTableIfExists('nc_cron').;
    // await this.knexConnection.schema.dropTableIfExists('nc_acl').;
  }

  public async isMetaDataExists(
    base_id: string,
    dbAlias: string,
  ): Promise<boolean> {
    const query = this.knexConnection('nc_models');
    if (base_id !== null && base_id !== undefined) {
      query.where('base_id', base_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }
    const data = await query.first();

    return !!data;
  }

  async commit() {
    if (this.trx) {
      await this.trx.commit();
    }
    this.trx = null;
  }

  async rollback(e?) {
    if (this.trx) {
      await this.trx.rollback(e);
    }
    this.trx = null;
  }

  async startTransaction(): Promise<MetaService> {
    const trx = await this.connection.transaction();

    // todo: Extend transaction class to add our custom properties
    Object.assign(trx, {
      clientType: this.connection.clientType,
      searchPath: (this.connection as any).searchPath,
    });

    // todo: tobe done
    return new MetaService(this.config, trx);
  }

  async metaReset(
    base_id: string,
    dbAlias: string,
    apiType?: string,
  ): Promise<void> {
    // const apiType: string = this.config?.envs?.[this.config.env || this.config.workingEnv]?.db.find(d => {
    //   return d.meta.dbAlias === dbAlias;
    // })?.meta?.api?.type;

    if (apiType) {
      await Promise.all(
        META_TABLES?.[apiType]?.map((table) => {
          return (async () => {
            try {
              await this.knexConnection(table)
                .where({ db_alias: dbAlias, base_id })
                .del();
            } catch (e) {
              console.warn(`Error: ${table} reset failed`);
            }
          })();
        }),
      );
    }
  }

  public async baseCreate(
    baseName: string,
    config: any,
    description?: string,
    meta?: boolean,
  ): Promise<any> {
    try {
      const ranId = this.getNanoId();
      const id = `${baseName.toLowerCase().replace(/\W+/g, '_')}_${ranId}`;
      if (meta) {
        config.prefix = `nc_${ranId}__`;
        // if(config.envs._noco?.db?.[0]?.meta?.tn){
        //   config.envs._noco.db[0].meta.tn += `_${prefix}`
        // }
      }
      config.id = id;
      const base: any = {
        id,
        title: baseName,
        description,
        config: CryptoJS.AES.encrypt(
          JSON.stringify(config),
          'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
        ).toString(),
      };
      // todo: check base name used or not
      await this.knexConnection('nc_projects').insert({
        ...base,
        created_at: this.now(),
        updated_at: this.now(),
      });

      // todo
      await this.knexConnection(MetaTable.PROJECT).insert({
        id,
        title: baseName,
      });

      base.prefix = config.prefix;
      return base;
    } catch (e) {
      console.log(e);
    }
  }

  public async baseUpdate(baseId: string, config: any): Promise<any> {
    try {
      const base = {
        config: CryptoJS.AES.encrypt(
          JSON.stringify(config, null, 2),
          'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
        ).toString(),
      };
      // todo: check base name used or not
      await this.knexConnection('nc_projects').update(base).where({
        id: baseId,
      });
    } catch (e) {
      console.log(e);
    }
  }

  public async baseList(): Promise<any[]> {
    return (await this.knexConnection('nc_projects').select()).map((p) => {
      p.config = CryptoJS.AES.decrypt(
        p.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
      return p;
    });
  }

  public async userProjectList(userId: any): Promise<any[]> {
    return (
      await this.knexConnection('nc_projects')
        .leftJoin(
          this.knexConnection('nc_projects_users')
            .where(`nc_projects_users.user_id`, userId)
            .as('user'),
          'user.base_id',
          'nc_projects.id',
        )
        .select('nc_projects.*')
        .select('user.user_id')
        .select(
          this.knexConnection('xc_users')
            .select('xc_users.email')
            .innerJoin(
              'nc_projects_users',
              'nc_projects_users.user_id',
              '=',
              'xc_users.id',
            )
            .whereRaw('nc_projects.id = nc_projects_users.base_id')
            .where('nc_projects_users.roles', 'like', '%owner%')
            .first()
            .as('owner'),
        )
        .select(
          this.knexConnection('xc_users')
            .count('xc_users.id')
            .innerJoin(
              'nc_projects_users',
              'nc_projects_users.user_id',
              '=',
              'xc_users.id',
            )
            .where((qb) => {
              qb.where('nc_projects_users.roles', 'like', '%creator%').orWhere(
                'nc_projects_users.roles',
                'like',
                '%owner%',
              );
            })
            .whereRaw('nc_projects.id = nc_projects_users.base_id')
            .andWhere('xc_users.id', userId)
            .first()
            .as('is_creator'),
        )
    ).map((p) => {
      p.allowed = p.user_id === userId;
      p.config = CryptoJS.AES.decrypt(
        p.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
      return p;
    });
  }

  public async isUserHaveAccessToProject(
    baseId: string,
    userId: any,
  ): Promise<boolean> {
    return !!(await this.knexConnection('nc_projects_users')
      .where({
        base_id: baseId,
        user_id: userId,
      })
      .first());
  }

  public async baseGet(baseName: string, encrypt?): Promise<any> {
    const base = await this.knexConnection('nc_projects')
      .where({
        title: baseName,
      })
      .first();

    if (base && !encrypt) {
      base.config = CryptoJS.AES.decrypt(
        base.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
    }
    return base;
  }

  public async baseGetById(baseId: string, encrypt?): Promise<any> {
    const base = await this.knexConnection('nc_projects')
      .where({
        id: baseId,
      })
      .first();
    if (base && !encrypt) {
      base.config = CryptoJS.AES.decrypt(
        base.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
    }
    return base;
  }

  public baseDelete(title: string): Promise<any> {
    return this.knexConnection('nc_projects')
      .where({
        title,
      })
      .delete();
  }

  public baseDeleteById(id: string): Promise<any> {
    return this.knexConnection('nc_projects')
      .where({
        id,
      })
      .delete();
  }

  public async baseStatusUpdate(baseId: string, status: string): Promise<any> {
    return this.knexConnection('nc_projects')
      .update({
        status,
      })
      .where({
        id: baseId,
      });
  }

  public async baseAddUser(
    baseId: string,
    userId: any,
    roles: string,
  ): Promise<any> {
    if (
      await this.knexConnection('nc_projects_users')
        .where({
          user_id: userId,
          base_id: baseId,
        })
        .first()
    ) {
      return {};
    }
    return this.knexConnection('nc_projects_users').insert({
      user_id: userId,
      base_id: baseId,
      roles,
    });
  }

  public baseRemoveUser(baseId: string, userId: any): Promise<any> {
    return this.knexConnection('nc_projects_users')
      .where({
        user_id: userId,
        base_id: baseId,
      })
      .delete();
  }

  public removeXcUser(userId: any): Promise<any> {
    return this.knexConnection('xc_users')
      .where({
        id: userId,
      })
      .delete();
  }

  private getNanoId() {
    return nanoid();
  }

  private isMySQL(): boolean {
    return (
      this.connection.clientType() === 'mysql' ||
      this.connection.clientType() === 'mysql2'
    );
  }

  private now(): any {
    return dayjs()
      .utc()
      .format(this.isMySQL() ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ');
  }

  public async audit(
    base_id: string,
    dbAlias: string,
    target: string,
    data: any,
  ): Promise<any> {
    if (['DATA', 'COMMENT'].includes(data?.op_type)) {
      return Promise.resolve(undefined);
    }
    return this.metaInsert(base_id, dbAlias, target, data);
  }

  public async init(): Promise<boolean> {
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSource(),
      tableName: 'xc_knex_migrations',
    });
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourcev2(),
      tableName: 'xc_knex_migrationsv2',
    });
    return true;
  }
}
