import { MetaService as MetaServiceCE } from 'src/meta/meta.service';
import { Injectable, Optional } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { v7 as uuidv7 } from 'uuid';
import type { Condition, Knex } from '~/db/CustomKnex';
import XcMigrationSourcev3 from '~/meta/migrations/XcMigrationSourcev3';
import { NcConfig } from '~/utils/nc-config';
import { MetaTable, RootScopes, RootScopeTables } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const nanoidWorkspace = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

@Injectable()
export class MetaService extends MetaServiceCE {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }

  public async init(): Promise<boolean> {
    await super.init();
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourcev3(),
      tableName: 'xc_knex_migrationsv3',
    });
    return true;
  }

  async startTransaction(): Promise<MetaService> {
    const trx = await this.connection.transaction();

    // todo: Extend transaction class to add our custom properties
    Object.assign(trx, {
      clientType: this.connection.clientType,
      searchPath: (this.connection as any).searchPath,
    });

    return new MetaService(this.config, trx);
  }

  /***
   * Generate nanoid for the given target
   * @param target - Table name
   * @returns {string} - Generated nanoid
   * */
  public async genNanoid(target: string) {
    if (target === MetaTable.AUDIT) {
      return uuidv7();
    }

    const prefixMap: { [key: string]: string } = {
      [MetaTable.PROJECT]: 'p',
      [MetaTable.SOURCES]: 'b',
      [MetaTable.SOURCES_OLD]: 'b',
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
      [MetaTable.TEAMS]: 'tm',
      [MetaTable.VIEWS]: 'vw',
      [MetaTable.HOOKS]: 'hk',
      [MetaTable.HOOK_LOGS]: 'hkl',
      [MetaTable.API_TOKENS]: 'tkn',
      [MetaTable.WORKSPACE]: 'w',
      [MetaTable.COWRITER]: 'cw',
      [MetaTable.SSO_CLIENT]: 'sso',
      [MetaTable.ORG]: 'o',
      [MetaTable.EXTENSIONS]: 'ext',
      [MetaTable.COMMENTS]: 'com',
      [MetaTable.COMMENTS_REACTIONS]: 'cre',
      [MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE]: 'cnp',
      [MetaTable.JOBS]: 'job',
      [MetaTable.INTEGRATIONS]: 'int',
      [MetaTable.FILE_REFERENCES]: 'at',
      [MetaTable.COL_BUTTON]: 'btn',
      [MetaTable.SNAPSHOT]: 'snap',
      [MetaTable.CUSTOM_URLS]: 'cu',
      [MetaTable.SCRIPTS]: 'scr',
      [MetaTable.SYNC_CONFIGS]: 'sync',
      [MetaTable.PLANS]: 'pl',
      [MetaTable.SUBSCRIPTIONS]: 'sub',
    };

    const prefix = prefixMap[target] || 'nc';
    let id: string;

    do {
      // using nanoid to avoid collision with existing ids when duplicating
      id = `${prefix}${
        target === MetaTable.WORKSPACE ? nanoidWorkspace() : nanoidv2()
      }`;
      // re-generate id if already in use
    } while (await this.knex(target).where({ id }).first());

    return id;
  }

  public contextCondition(
    query: Knex.QueryBuilder,
    workspace_id: string,
    base_id: string,
    target: string,
  ) {
    if (workspace_id === base_id) {
      return;
    }

    if (target === MetaTable.WORKSPACE) {
      return;
    }

    query.where('fk_workspace_id', workspace_id);

    if (base_id === RootScopes.WORKSPACE) {
      return;
    }

    if (target !== MetaTable.PROJECT) {
      query.where('base_id', base_id);
    } else {
      query.where('id', base_id);
    }
  }

  /***
   * Insert record into meta data
   * @param workspace_id - Workspace id
   * @param base_id - Base id
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
      if (!workspace_id) {
        NcError.metaError({
          message: 'Workspace ID is required',
          sql: '',
        });
      }

      insertObj.fk_workspace_id = workspace_id;

      if (!base_id && base_id !== RootScopes.WORKSPACE) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
      if (base_id !== RootScopes.WORKSPACE) insertObj.base_id = base_id;
    }

    const at = this.now();
    insertObj.created_at = at;
    insertObj.updated_at = at;

    const qb = this.knexConnection(target).insert(insertObj);

    this.logHelper(workspace_id, base_id, target, qb);

    await qb;

    return insertObj;
  }

  /***
   * Insert multiple records into meta data
   * @param workspace_id - Workspace id
   * @param base_id - Base id
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
      if (!workspace_id) {
        NcError.metaError({
          message: 'Workspace ID is required',
          sql: '',
        });
      }

      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }

      commonProps.fk_workspace_id = workspace_id;
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
      if (!workspace_id) {
        NcError.metaError({
          message: 'Workspace ID is required',
          sql: '',
        });
      }

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
      if (!workspace_id) {
        NcError.metaError({
          message: 'Workspace ID is required',
          sql: '',
        });
      }

      if (!base_id && base_id !== RootScopes.WORKSPACE) {
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

    this.logHelper(workspace_id, base_id, target, query);

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
      if (!workspace_id) {
        NcError.metaError({
          message: 'Workspace ID is required',
          sql: '',
        });
      }

      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }

      this.contextCondition(query, workspace_id, base_id, target);
    }

    if (!idOrCondition) {
      this.logHelper(workspace_id, base_id, target, query);

      return query.first();
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else {
      query.where(idOrCondition);
    }

    this.logHelper(workspace_id, base_id, target, query);

    return query.first();
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

      const r = RootScopeTables[workspace_id];
      if (!r) {
        console.log('Invalid scope', RootScopeTables);
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!workspace_id) {
        NcError.metaError({
          message: 'Workspace ID is required',
          sql: '',
        });
      }

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

    this.logHelper(workspace_id, base_id, target, query);

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
      if (!workspace_id) {
        NcError.metaError({
          message: 'Workspace ID is required',
          sql: '',
        });
      }

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

    this.logHelper(workspace_id, base_id, target, query);

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
    allowCreatedAt = false,
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
      if (!workspace_id) {
        NcError.metaError({
          message: 'Workspace ID is required',
          sql: '',
        });
      }

      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
    }

    if (!allowCreatedAt) {
      delete data.created_at;
    }

    if (!skipUpdatedAt) {
      data.updated_at = this.now();
    }

    query.update(data);
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

    this.logHelper(workspace_id, base_id, target, query);

    return await query;
  }

  logHelper? = async (workspace_id, base_id, target, q) => {
    const qStr = q.toQuery();

    if (workspace_id === RootScopes.BYPASS && base_id === RootScopes.BYPASS) {
      return;
    }

    if (target === MetaTable.PROJECT) {
      if (!qStr.includes('fk_workspace_id') || !qStr.includes('id')) {
        if (!(workspace_id in RootScopeTables)) {
          console.log(`Missing tenant isolation (${workspace_id}): ${qStr}`);
          console.log(new Error().stack);
        }
      }
    } else {
      if (
        !qStr.includes('fk_workspace_id') ||
        (base_id !== RootScopes.WORKSPACE && !qStr.includes('base_id'))
      ) {
        if (!(workspace_id in RootScopeTables)) {
          console.log(`Missing tenant isolation (${workspace_id}): ${qStr}`);
          console.log(new Error().stack);
        }
      }
    }
  };
}

export * from 'src/meta/meta.service';
