import { Injectable, Optional } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type * as knex from 'knex';
import type { Knex } from 'knex';
import type { Condition } from '~/db/CustomKnex';
import XcMigrationSource from '~/meta/migrations/XcMigrationSource';
import XcMigrationSourcev2 from '~/meta/migrations/XcMigrationSourcev2';
import { XKnex } from '~/db/CustomKnex';
import { NcConfig } from '~/utils/nc-config';
import { MetaTable } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
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

  /***
   * Get single record from meta data
   * @param base_id - Base id
   * @param dbAlias - Database alias
   * @param target - Table name
   * @param idOrCondition - If string, will get the record with the given id. If object, will get the record with the given condition.
   * @param fields - Fields to be selected
   */
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

  /***
   * Insert record into meta data
   * @param base_id - Base id
   * @param dbAlias - Database alias
   * @param target - Table name
   * @param data - Data to be inserted
   * @param ignoreIdGeneration - If true, will not generate id for the record
   */
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

  /***
   * Insert multiple records into meta data
   * @param base_id - Base id
   * @param source_id - Source id
   * @param target - Table name
   * @param data - Data to be inserted
   * @param ignoreIdGeneration - If true, will not generate id for the record
   */
  public async bulkMetaInsert(
    base_id: string,
    source_id: string,
    target: string,
    data: any | any[],
    ignoreIdGeneration?: boolean,
  ): Promise<any> {
    if (Array.isArray(data) ? !data.length : !data) {
      return [];
    }

    const insertObj = [];
    const at = this.now();

    const commonProps: Record<string, any> = {
      created_at: at,
      updated_at: at,
    };

    if (source_id !== null) commonProps.source_id = source_id;
    if (base_id !== null) commonProps.base_id = base_id;

    for (const d of Array.isArray(data) ? data : [data]) {
      const id = d?.id || (await this.genNanoid(target));
      const tempObj = {
        ...d,
        ...(ignoreIdGeneration ? {} : { id }),
        ...commonProps,
      };
      insertObj.push(tempObj);
    }

    await this.knexConnection.batchInsert(target, insertObj);

    return insertObj;
  }

  /***
   * Generate nanoid for the given target
   * @param target - Table name
   * @returns {string} - Generated nanoid
   * */
  public async genNanoid(target: string) {
    const prefixMap: { [key: string]: string } = {
      [MetaTable.PROJECT]: 'p',
      [MetaTable.BASES]: 'b',
      [MetaTable.MODELS]: 'm',
      [MetaTable.COLUMNS]: 'c',
      [MetaTable.COL_RELATIONS]: 'l',
      [MetaTable.COL_SELECT_OPTIONS]: 's',
      [MetaTable.COL_LOOKUP]: 'lk',
      [MetaTable.COL_ROLLUP]: 'rl',
      [MetaTable.COL_FORMULA]: 'f',
      [MetaTable.FILTER_EXP]: 'fi',
      [MetaTable.SORT]: 'so',
      [MetaTable.SHARED_VIEWS]: 'sv',
      [MetaTable.ACL]: 'ac',
      [MetaTable.FORM_VIEW]: 'fv',
      [MetaTable.FORM_VIEW_COLUMNS]: 'fvc',
      [MetaTable.GALLERY_VIEW]: 'gv',
      [MetaTable.GALLERY_VIEW_COLUMNS]: 'gvc',
      [MetaTable.KANBAN_VIEW]: 'kv',
      [MetaTable.KANBAN_VIEW_COLUMNS]: 'kvc',
      [MetaTable.CALENDAR_VIEW]: 'cv',
      [MetaTable.CALENDAR_VIEW_COLUMNS]: 'cvc',
      [MetaTable.CALENDAR_VIEW_RANGE]: 'cvr',
      [MetaTable.USERS]: 'us',
      [MetaTable.ORGS_OLD]: 'org',
      [MetaTable.TEAMS]: 'tm',
      [MetaTable.VIEWS]: 'vw',
      [MetaTable.HOOKS]: 'hk',
      [MetaTable.HOOK_LOGS]: 'hkl',
      [MetaTable.AUDIT]: 'adt',
      [MetaTable.API_TOKENS]: 'tkn',
      [MetaTable.EXTENSIONS]: 'ext',
      [MetaTable.COMMENTS]: 'com',
      [MetaTable.COMMENTS_REACTIONS]: 'cre',
      [MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE]: 'cnp',
    };

    const prefix = prefixMap[target] || 'nc';

    // using nanoid to avoid collision with existing ids when duplicating
    return `${prefix}${nanoidv2()}`;
  }
  /***
   * Get paginated list of meta data
   * @param baseId - Base id
   * @param dbAlias - Database alias
   * @param target - Table name
   * @param args.condition - Condition to be applied
   * @param args.limit - Limit of records
   * @param args.offset - Offset of records
   * @param args.xcCondition - Additional nested or complex condition to be added to the query.
   * @param args.fields - Fields to be selected
   * @param args.sort - Sort field and direction
   * @returns {Promise<{list: any[]; count: number}>} - List of records and count
   * */
  public async metaPaginatedList(
    baseId: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [key: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?: Condition;
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

  /***
   * Delete meta data
   * @param base_id - Base id
   * @param dbAlias - Database alias
   * @param target - Table name
   * @param idOrCondition - If string, will delete the record with the given id. If object, will delete the record with the given condition.
   * @param xcCondition - Additional nested or complex condition to be added to the query.
   * @param force - If true, will not check if a condition is present in the query builder and will execute the query as is.
   */
  public async metaDelete(
    base_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    xcCondition?: Condition,
    force = false,
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

    // Check if a condition is present in the query builder and throw an error if not.
    if (!force) {
      this.checkConditionPresent(query, 'delete');
    }

    return query.del();
  }

  /***
   * Get meta data
   * @param base_id - Base id
   * @param sourceId - Source id
   * @param target - Table name
   * @param idOrCondition - If string, will get the record with the given id. If object, will get the record with the given condition.
   * @param fields - Fields to be selected
   * @param xcCondition - Additional nested or complex condition to be added to the query.
   */
  public async metaGet2(
    base_id: string,
    sourceId: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    xcCondition?: Condition,
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

  /***
   * Get order value for the next record
   * @param target - Table name
   * @param condition - Condition to be applied
   * @returns {Promise<number>} - Order value
   * */
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
      xcCondition?: Condition;
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

  /***
   * Get list of meta data
   * @param base_id - Base id
   * @param dbAlias - Database alias
   * @param target - Table name
   * @param args.condition - Condition to be applied
   * @param args.limit - Limit of records
   * @param args.offset - Offset of records
   * @param args.xcCondition - Additional nested or complex condition to be added to the query.
   * @param args.fields - Fields to be selected
   * @param args.orderBy - Order by fields
   * @returns {Promise<any[]>} - List of records
   * */
  public async metaList2(
    base_id: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?: Condition;
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

    query.andWhere((qb) => {
      qb.where({});
    });

    return query;
  }

  /***
   * Get count of meta data
   * @param base_id - Base id
   * @param dbAlias - Database alias
   * @param target - Table name
   * @param args.condition - Condition to be applied
   * @param args.xcCondition - Additional nested or complex condition to be added to the query.
   * @param args.aggField - Field to be aggregated
   * @returns {Promise<number>} - Count of records
   * */
  public async metaCount(
    base_id: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      xcCondition?: Condition;
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

  /***
   * Update meta data
   * @param base_id - Base id
   * @param dbAlias - Database alias
   * @param target - Table name
   * @param data - Data to be updated
   * @param idOrCondition - If string, will update the record with the given id. If object, will update the record with the given condition.
   * @param xcCondition - Additional nested or complex condition to be added to the query.
   * @param force - If true, will not check if a condition is present in the query builder and will execute the query as is.
   */
  public async metaUpdate(
    base_id: string,
    dbAlias: string,
    target: string,
    data: any,
    idOrCondition?: string | { [p: string]: any },
    xcCondition?: Condition,
    force = false,
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

    // Check if a condition is present in the query builder and throw an error if not.
    if (!force) {
      this.checkConditionPresent(query, 'update');
    }

    return await query;
  }

  public async metaDeleteAll(
    _project_id: string,
    _dbAlias: string,
  ): Promise<void> {
    NcError.notImplemented('metaDeleteAll');
    // await this.knexConnection..dropTableIfExists('nc_roles').;
    // await this.knexConnection.schema.dropTableIfExists('nc_store').;
    // await this.knexConnection.schema.dropTableIfExists('nc_hooks').;
    // await this.knexConnection.schema.dropTableIfExists('nc_cron').;
    // await this.knexConnection.schema.dropTableIfExists('nc_acl').;
  }

  /***
   * Check table meta data exists for a given base id and db alias
   * @param base_id - Base id
   * @param dbAlias - Database alias
   * @returns {Promise<boolean>} - True if meta data exists, false otherwise
   * */
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

  /***
   * Create a new base
   * @param baseName - Base name
   * @param config - Base config
   * @param description - Base description
   * @param meta - If true, will create a meta base
   * @returns {Promise<any>} - Created base
   * */
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

  /***
   * Update base config
   * @param baseId - Base id
   * @param config - Base config
   * */
  public async baseUpdate(baseId: string, config: any): Promise<any> {
    if (!baseId) {
      NcError.metaError({
        message: 'Base Id is required to update base config',
        sql: '',
      });
    }

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

  /***
   * Get base list with decrypted config
   * @returns {Promise<any[]>} - List of bases
   * */
  public async baseList(): Promise<any[]> {
    return (await this.knexConnection('nc_projects').select()).map((p) => {
      p.config = CryptoJS.AES.decrypt(
        p.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
      return p;
    });
  }

  /***
   * Get base list with decrypted config for a user
   * @returns {Promise<any[]>} - List of bases
   * */
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

  /***
   * Check if user have access to a project
   * @param baseId - Base id
   * @param userId - User id
   * @returns {Promise<boolean>} - True if user have access, false otherwise
   * */
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

  /***
   * Get base by name
   * @param baseName - Base name
   * @param encrypt - If true, will skip the decryption of config
   * @returns {Promise<any>} - Base
   * */
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

  /***
   * Get base by id
   * @param baseId - Base id
   * @param encrypt - If true, will skip the decryption of config
   * @returns {Promise<any>} - Base
   * */
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

  /***
   * Delete base by name
   * @param title - Base name
   * */
  public baseDelete(title: string): Promise<any> {
    if (!title) {
      NcError.metaError({
        message: 'Base title is required to delete base',
        sql: '',
      });
    }

    return this.knexConnection('nc_projects')
      .where({
        title,
      })
      .delete();
  }

  /***
   * Delete base by id
   * @param id - Base id
   * */
  public baseDeleteById(id: string): Promise<any> {
    if (!id) {
      NcError.metaError({
        message: 'Base id is required to delete base',
        sql: '',
      });
    }
    return this.knexConnection('nc_projects')
      .where({
        id,
      })
      .delete();
  }

  /***
   * Update base status
   * @param baseId - Base id
   * @param status - Base status
   * */
  public async baseStatusUpdate(baseId: string, status: string): Promise<any> {
    if (!baseId) {
      NcError.metaError({
        message: 'Base id is required to update base status',
        sql: '',
      });
    }

    return this.knexConnection('nc_projects')
      .update({
        status,
      })
      .where({
        id: baseId,
      });
  }

  /***
   * Add user to base
   * @param baseId - Base id
   * @param userId - User id
   * @param roles - User roles
   * */
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

  /***
   * Remove user from base
   * @param baseId - Base id
   * @param userId - User id
   * */
  public baseRemoveUser(baseId: string, userId: any): Promise<any> {
    if (!baseId || !userId) {
      NcError.metaError({
        message: 'Base id and user id is required to remove user from base',
        sql: '',
      });
    }

    return this.knexConnection('nc_projects_users')
      .where({
        user_id: userId,
        base_id: baseId,
      })
      .delete();
  }

  public removeXcUser(userId: any): Promise<any> {
    if (!userId) {
      NcError.metaError({
        message: 'User id is required to remove user',
        sql: '',
      });
    }

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

  public now(): any {
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

  /**
   * Checks if a condition is present in the query builder and throws an error if not.
   *
   * @param queryBuilder - The Knex QueryBuilder instance to check.
   */
  private checkConditionPresent(
    queryBuilder: Knex.QueryBuilder,
    operation: 'delete' | 'update',
  ) {
    // Convert the query builder to a SQL string to inspect the presence of a WHERE clause.
    const sql = queryBuilder.toString();

    // Ensure that a WHERE condition is present in the query builder.
    // Note: The `hasWhere` method alone is not sufficient since it can indicate an empty nested WHERE group.
    // Therefore, also check the SQL string for the presence of the 'WHERE' keyword.
    if (queryBuilder.hasWhere() && /\bWHERE\b/i.test(sql)) {
      return;
    }

    // Throw an error if no condition is found in the query builder.
    NcError.metaError({
      message: 'A condition is required to ' + operation + ' records.',
      sql,
    });
  }
}
