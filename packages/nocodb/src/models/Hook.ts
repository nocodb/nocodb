import type { BoolType, HookReqType, HookType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Model from '~/models/Model';
import Filter from '~/models/Filter';
import HookFilter from '~/models/HookFilter';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';

export default class Hook implements HookType {
  id?: string;
  fk_model_id?: string;
  title?: string;
  description?: string;
  env?: string;
  type?: string;
  event?: HookType['event'];
  operation?: HookType['operation'];
  async?: BoolType;
  payload?: string;
  url?: string;
  headers?: string;
  condition?: BoolType;
  notification?: string | Record<string, any>;
  retries?: number;
  retry_interval?: number;
  timeout?: number;
  active?: BoolType;

  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  version?: 'v1' | 'v2';

  constructor(hook: Partial<Hook | HookReqType>) {
    Object.assign(this, hook);
  }

  public static async get(
    context: NcContext,
    hookId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let hook =
      hookId &&
      (await NocoCache.get(
        `${CacheScope.HOOK}:${hookId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!hook) {
      hook = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.HOOKS,
        hookId,
      );
      await NocoCache.set(`${CacheScope.HOOK}:${hookId}`, hook);
    }
    return hook && new Hook(hook);
  }

  public async getFilters(context: NcContext, ncMeta = Noco.ncMeta) {
    return await Filter.rootFilterListByHook(
      context,
      { hookId: this.id },
      ncMeta,
    );
  }

  static async list(
    context: NcContext,
    param: {
      fk_model_id: string;
      event?: HookType['event'];
      operation?: HookType['operation'];
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.HOOK, [
      param.fk_model_id,
    ]);
    let { list: hooks } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !hooks.length) {
      hooks = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.HOOKS,
        {
          condition: {
            fk_model_id: param.fk_model_id,
            // ...(param.event ? { event: param.event?.toLowerCase?.() } : {}),
            // ...(param.operation
            //   ? { operation: param.operation?.toLowerCase?.() }
            //   : {})
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.HOOK, [param.fk_model_id], hooks);
    }
    // filter event & operation
    if (param.event) {
      hooks = hooks.filter(
        (h) => h.event?.toLowerCase() === param.event?.toLowerCase(),
      );
    }
    if (param.operation) {
      hooks = hooks.filter(
        (h) => h.operation?.toLowerCase() === param.operation?.toLowerCase(),
      );
    }
    return hooks?.map((h) => new Hook(h));
  }

  public static async insert(
    context: NcContext,
    hook: Partial<Hook>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(hook, [
      'fk_model_id',
      'title',
      'description',
      'env',
      'type',
      'event',
      'operation',
      'async',
      'url',
      'headers',
      'condition',
      'notification',
      'retries',
      'retry_interval',
      'timeout',
      'active',
      'base_id',
      'source_id',
    ]);

    if (insertObj.notification && typeof insertObj.notification === 'object') {
      insertObj.notification = JSON.stringify(insertObj.notification);
    }

    const model = await Model.getByIdOrName(
      context,
      { id: hook.fk_model_id },
      ncMeta,
    );

    if (!insertObj.source_id) {
      insertObj.source_id = model.source_id;
    }

    // new hook will set as version 2
    insertObj.version = 'v2';

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOKS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (hook) => {
      await NocoCache.appendToList(
        CacheScope.HOOK,
        [hook.fk_model_id],
        `${CacheScope.HOOK}:${id}`,
      );
      return hook;
    });
  }

  public static async update(
    context: NcContext,
    hookId: string,
    hook: Partial<Hook>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(hook, [
      'title',
      'description',
      'env',
      'type',
      'event',
      'operation',
      'async',
      'payload',
      'url',
      'headers',
      'condition',
      'notification',
      'retries',
      'retry_interval',
      'timeout',
      'active',
      'version',
    ]);

    if (
      updateObj.version &&
      updateObj.operation &&
      updateObj.version === 'v1' &&
      ['bulkInsert', 'bulkUpdate', 'bulkDelete'].includes(updateObj.operation)
    ) {
      NcError.badRequest(`${updateObj.operation} not supported in v1 hook`);
    }

    if (updateObj.notification && typeof updateObj.notification === 'object') {
      updateObj.notification = JSON.stringify(updateObj.notification);
    }

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOKS,
      updateObj,
      hookId,
    );

    await NocoCache.update(`${CacheScope.HOOK}:${hookId}`, updateObj);

    return this.get(context, hookId, ncMeta);
  }

  static async delete(context: NcContext, hookId: any, ncMeta = Noco.ncMeta) {
    // Delete Hook Filters
    const filterList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        condition: { fk_hook_id: hookId },
      },
    );
    for (const filter of filterList) {
      await NocoCache.deepDel(
        `${CacheScope.FILTER_EXP}:${filter.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
      await HookFilter.delete(context, filter.id, ncMeta);
    }
    // Delete Hook
    await NocoCache.deepDel(
      `${CacheScope.HOOK}:${hookId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOKS,
      hookId,
    );
  }

  static async hookUsages(
    context: NcContext,
    hookId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_BUTTON,
      {
        condition: { fk_webhook_id: hookId },
      },
    );
  }
}
