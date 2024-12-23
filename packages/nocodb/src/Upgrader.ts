import NocoCache from './cache/NocoCache';
import type { Condition } from '~/db/CustomKnex';
import Noco from '~/Noco';
import { MetaService } from '~/meta/meta.service';
import { MetaTable, RootScopes, RootScopeTables } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';

const BATCH_SIZE = 500;

export default class Upgrader extends MetaService {
  protected _upgrader_mode: boolean;
  protected _upgrader_queries: string[] = [];

  constructor() {
    const ncMeta = Noco.ncMeta;
    super(ncMeta.config, ncMeta.knex);
  }

  get upgrader_mode(): boolean {
    return this._upgrader_mode;
  }

  get upgrader_queries(): string[] {
    return this._upgrader_queries;
  }

  public async metaInsert2(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any,
    ignoreIdGeneration?: boolean,
  ): Promise<any> {
    if (!this._upgrader_mode) throw new Error('Upgrader mode is not enabled');

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

    const qb = this.knexConnection(target).insert({
      ...insertObj,
      created_at: this.now(),
      updated_at: this.now(),
    });

    this.logHelper(workspace_id, base_id, target, qb);

    if (this._upgrader_mode === true) {
      await this.pushUpgraderQuery(qb.toQuery());
      return insertObj;
    }

    await qb;

    return insertObj;
  }

  public async bulkMetaInsert(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any | any[],
    ignoreIdGeneration?: boolean,
  ): Promise<any> {
    if (!this._upgrader_mode) throw new Error('Upgrader mode is not enabled');

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

    if (this._upgrader_mode === true) {
      await this.pushUpgraderQuery(
        insertObj.map((d) => this.knexConnection(target).insert(d).toQuery()),
      );
      return insertObj;
    }

    await this.knexConnection.batchInsert(target, insertObj);

    return insertObj;
  }

  public async bulkMetaUpdate(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any | any[],
    ids: string[],
    condition?: { [p: string]: any },
  ): Promise<any> {
    if (!this._upgrader_mode) throw new Error('Upgrader mode is not enabled');

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

    if (this._upgrader_mode === true) {
      await this.pushUpgraderQuery(query.toQuery());
      return null;
    }

    return query;
  }

  public async metaDelete(
    workspace_id: string,
    base_id: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    xcCondition?: Condition,
    force = false,
  ): Promise<void> {
    if (!this._upgrader_mode) throw new Error('Upgrader mode is not enabled');

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

    this.logHelper(workspace_id, base_id, target, query);

    if (this._upgrader_mode === true) {
      await this.pushUpgraderQuery(query.del().toQuery());
      return;
    }

    return query.del();
  }

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
    if (!this._upgrader_mode) throw new Error('Upgrader mode is not enabled');

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

    if (this._upgrader_mode === true) {
      await this.pushUpgraderQuery(query.toQuery());
      return null;
    }

    return await query;
  }

  enableUpgraderMode?() {
    NocoCache.disableCache();
    this._upgrader_mode = true;
  }

  async disableUpgraderMode?() {
    NocoCache.enableCache();
    await NocoCache.destroy();
    this._upgrader_mode = false;
  }

  async pushUpgraderQuery(query: string | string[]) {
    if (Array.isArray(query)) {
      this._upgrader_queries.push(...query);
    } else {
      this._upgrader_queries.push(query);
    }
  }

  async runUpgraderQueries() {
    if (!this._upgrader_mode) throw new Error('Upgrader mode is not enabled');

    const queries = this._upgrader_queries.splice(0, BATCH_SIZE);

    if (!queries.length) return [];

    const trans = await this.knexConnection.transaction();

    try {
      for (const query of queries) {
        await trans.raw(query);
      }
      await trans.commit();
    } catch (e) {
      await trans.rollback();
      throw e;
    }
  }

  logHelper? = async (_workspace_id, _base_id, _target, _q) => {};
}
