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
import { MetaTable, RootScopes, RootScopeTables } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';

dayjs.extend(utc);
dayjs.extend(timezone);

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);
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

  public contextCondition(
    query: Knex.QueryBuilder,
    workspace_id: string,
    base_id: string,
    target: string,
  ) {
    if (workspace_id === base_id || base_id === RootScopes.WORKSPACE) {
      return;
    }

    if (target !== MetaTable.PROJECT) {
      query.where('base_id', base_id);
    } else {
      query.where('id', base_id);
    }
  }

  /***
   * Get single record from meta data
   * @param workspace_id - Workspace id
   * @param base_id - Base alias
   * @param target - Table name
   * @param idOrCondition - If string, will get the record with the given id. If object, will get the record with the given condition.
   * @param fields - Fields to be selected
   */
  public async metaGet(
    workspace_id: string,
    base_id: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    // xcCondition?
  ): Promise<any> {
    return this.metaGet2(workspace_id, base_id, target, idOrCondition, fields);
  }

  /***
   * Insert record into meta data
   * @param fk_workspace_id - Base id
   * @param dbAlias - Database alias
   * @param target - Table name
   * @param data - Data to be inserted
   * @param ignoreIdGeneration - If true, will not generate id for the record
   */
  public async metaInsert2(
    workspace_id: string,
    base_id: string,
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

    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
      if (base_id !== RootScopes.WORKSPACE) insertObj.base_id = base_id;
    }

    await this.knexConnection(target).insert({
      ...insertObj,
      created_at: this.now(),
      updated_at: this.now(),
    });

    return insertObj;
  }

  /***
   * Insert multiple records into meta data
   * @param workspace_id - Workspace id
   * @param base_id - Source id
   * @param target - Table name
   * @param data - Data to be inserted
   * @param ignoreIdGeneration - If true, will not generate id for the record
   */
  public async bulkMetaInsert(
    workspace_id: string,
    base_id: string,
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

    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
      commonProps.base_id = base_id;
    }

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
   * Update multiple records in meta data
   * @param workspace_id - Workspace id
   * @param base_id - Base id
   * @param target - Table name
   * @param data - Data to be updated
   * @param ids - Ids of the records to be updated
   */
  public async bulkMetaUpdate(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any | any[],
    ids: string[],
    condition?: { [p: string]: any },
  ): Promise<any> {
    if (Array.isArray(data) ? !data.length : !data) {
      return [];
    }

    const query = this.knexConnection(target);

    const at = this.now();

    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
    }

    const updateObj = {
      ...data,
      updated_at: at,
    };

    if (!condition) {
      query.whereIn('id', ids).update(updateObj);
    } else {
      if (![MetaTable.FILE_REFERENCES].includes(target as MetaTable)) {
        NcError.metaError({
          message: 'This table does not support conditional bulk update',
          sql: '',
        });
      }

      query.where(condition);

      // Check if a condition is present in the query builder and throw an error if not.
      this.checkConditionPresent(query, 'update');

      query.update(updateObj);
    }

    this.contextCondition(query, workspace_id, base_id, target);

    return query;
  }

  /***
   * Generate nanoid for the given target
   * @param target - Table name
   * @returns {string} - Generated nanoid
   * */
  public async genNanoid(target: string) {
    const prefixMap: { [key: string]: string } = {
      [MetaTable.PROJECT]: 'p',
      [MetaTable.SOURCES]: 'b',
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
      [MetaTable.JOBS]: 'job',
      [MetaTable.INTEGRATIONS]: 'int',
      [MetaTable.FILE_REFERENCES]: 'at',
      [MetaTable.COL_BUTTON]: 'btn',
      [MetaTable.SNAPSHOT]: 'snap',
      [MetaTable.SCRIPTS]: 'scr',
    };

    const prefix = prefixMap[target] || 'nc';

    // using nanoid to avoid collision with existing ids when duplicating
    return `${prefix}${nanoidv2()}`;
  }

  // private connection: XKnex;
  // todo: need to fix
  private trx: Knex.Transaction;

  /***
   * Delete meta data
   * @param workspace_id - Workspace id
   * @param base_id - Base id
   * @param target - Table name
   * @param idOrCondition - If string, will delete the record with the given id. If object, will delete the record with the given condition.
   * @param xcCondition - Additional nested or complex condition to be added to the query.
   * @param force - If true, will not check if a condition is present in the query builder and will execute the query as is.
   */
  public async metaDelete(
    workspace_id: string,
    base_id: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    xcCondition?: Condition,
    force = false,
  ): Promise<void> {
    const query = this.knexConnection(target);

    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
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

    // Apply context condition
    this.contextCondition(query, workspace_id, base_id, target);

    return query.del();
  }

  /***
   * Get meta data
   * @param workspace_id - Workspace id
   * @param base_id - Base id
   * @param target - Table name
   * @param idOrCondition - If string, will get the record with the given id. If object, will get the record with the given condition.
   * @param fields - Fields to be selected
   * @param xcCondition - Additional nested or complex condition to be added to the query.
   */
  public async metaGet2(
    workspace_id: string,
    base_id: string,
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

    if (workspace_id === RootScopes.BYPASS && base_id === RootScopes.BYPASS) {
      // bypass
    } else if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }

      this.contextCondition(query, workspace_id, base_id, target);
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

  /***
   * Get list of meta data
   * @param workspace_id - Workspace id
   * @param base_id - Base id
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
    workspace_id: string,
    base_id: string,
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

    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }

      this.contextCondition(query, workspace_id, base_id, target);
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

  /***
   * Get count of meta data
   * @param workspace_id - Workspace id
   * @param base_id - Base id
   * @param target - Table name
   * @param args.condition - Condition to be applied
   * @param args.xcCondition - Additional nested or complex condition to be added to the query.
   * @param args.aggField - Field to be aggregated
   * @returns {Promise<number>} - Count of records
   * */
  public async metaCount(
    workspace_id: string,
    base_id: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      xcCondition?: Condition;
      aggField?: string;
    },
  ): Promise<number> {
    const query = this.knexConnection(target);

    if (workspace_id === RootScopes.BYPASS && base_id === RootScopes.BYPASS) {
      // bypass
    } else if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }

      this.contextCondition(query, workspace_id, base_id, target);
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
   * @param workspace_id - Workspace id
   * @param base_id - Base id
   * @param target - Table name
   * @param data - Data to be updated
   * @param idOrCondition - If string, will update the record with the given id. If object, will update the record with the given condition.
   * @param xcCondition - Additional nested or complex condition to be added to the query.
   * @param skipUpdatedAt - If true, will not update the updated_at field
   * @param force - If true, will not check if a condition is present in the query builder and will execute the query as is.
   */
  public async metaUpdate(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any,
    idOrCondition?: string | { [p: string]: any },
    xcCondition?: Condition,
    skipUpdatedAt = false,
    force = false,
  ): Promise<any> {
    const query = this.knexConnection(target);

    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
    }

    delete data.created_at;

    if (!skipUpdatedAt) {
      data.updated_at = this.now();
    }
    query.update({ ...data });
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

    // Apply context condition
    this.contextCondition(query, workspace_id, base_id, target);

    return await query;
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
    // check if table exists
    const tableExists = await this.knexConnection.schema.hasTable(
      'nc_projects',
    );

    if (!tableExists) {
      return [];
    }

    return (await this.knexConnection('nc_projects').select()).map((p) => {
      p.config = CryptoJS.AES.decrypt(
        p.config,
        'secret', // todo: tobe replaced - this.config?.auth?.jwt?.secret
      ).toString(CryptoJS.enc.Utf8);
      return p;
    });
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

  private isMssql(): boolean {
    return this.connection.clientType() === 'mssql';
  }

  public now(): any {
    return dayjs()
      .utc()
      .format(
        this.isMySQL() || this.isMssql()
          ? 'YYYY-MM-DD HH:mm:ss'
          : 'YYYY-MM-DD HH:mm:ssZ',
      );
  }

  public formatDateTime(date: string): string {
    return dayjs(date)
      .utc()
      .format(
        this.isMySQL() || this.isMssql()
          ? 'YYYY-MM-DD HH:mm:ss'
          : 'YYYY-MM-DD HH:mm:ssZ',
      );
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
  protected checkConditionPresent(
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
