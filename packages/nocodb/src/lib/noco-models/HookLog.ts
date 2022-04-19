import { MetaTable } from '../utils/globals';
import Noco from '../noco/Noco';
import extractProps from '../noco/meta/helpers/extractProps';
import Hook from './Hook';
import { HookLogType } from 'nocodb-sdk';

export default class HookLog implements HookLogType {
  id?: string;

  base_id?: string;
  project_id?: string;
  fk_hook_id?: string;
  type?: string;
  event?: string;
  operation?: string;
  test_call?: boolean;
  payload?: string;
  conditions?: string;
  notification?: string;
  error_code?: string;
  error_message?: string;
  error?: string;
  execution_time?: string;
  response?: string;
  triggered_by?: string;

  constructor(hook: Partial<HookLog>) {
    Object.assign(this, hook);
  }

  static async list(
    param: {
      fk_hook_id: string;
      event?: 'after' | 'before';
      operation?: 'insert' | 'delete' | 'update';
    },
    ncMeta = Noco.ncMeta
  ) {
    // todo: redis cache ??
    // let hooks = await NocoCache.getList(CacheScope.HOOK, [param.fk_model_id]);
    // if (!hooks.length) {
    const hookLogs = await ncMeta.metaList(null, null, MetaTable.HOOK_LOGS, {
      condition: {
        fk_hook_id: param.fk_hook_id
        // ...(param.event ? { event: param.event?.toLowerCase?.() } : {}),
        // ...(param.operation
        //   ? { operation: param.operation?.toLowerCase?.() }
        //   : {})
      }
    });
    //   await NocoCache.setList(CacheScope.HOOK, [param.fk_model_id], hooks);
    // }
    // // filter event & operation
    // if (param.event) {
    //   hooks = hooks.filter(
    //     h => h.event?.toLowerCase() === param.event?.toLowerCase()
    //   );
    // }
    // if (param.operation) {
    //   hooks = hooks.filter(
    //     h => h.operation?.toLowerCase() === param.operation?.toLowerCase()
    //   );
    // }
    return hookLogs?.map(h => new HookLog(h));
  }

  public static async insert(
    hookLog: Partial<
      (HookLog | HookLogType) & {
        created_at?;
        updated_at?;
      }
    >,
    ncMeta = Noco.ncMeta
  ) {
    const insertObj = extractProps(hookLog, [
      'base_id',
      'project_id',
      'fk_hook_id',
      'type',
      'event',
      'operation',
      'test_call',
      'payload',
      'conditions',
      'notification',
      'error_code',
      'error_message',
      'error',
      'execution_time',
      'response',
      'triggered_by'
    ]);

    if (!(hookLog.project_id && hookLog.base_id) && hookLog.fk_hook_id) {
      const hook = await Hook.get(hookLog.fk_hook_id, ncMeta);
      insertObj.project_id = hook.project_id;
      insertObj.base_id = hook.base_id;
    }

    return await ncMeta.metaInsert2(null, null, MetaTable.HOOK_LOGS, insertObj);

    // todo: redis cache ??
    // await NocoCache.appendToList(
    //   CacheScope.HOOK,
    //   [insertObj.fk_mo_id],
    //   `${CacheScope.HOOK}:${id}`
    // );

    // return this.get(id, ncMeta);
  }

  // static async delete(hookId: any, ncMeta = Noco.ncMeta) {
  //   await NocoCache.deepDel(
  //     CacheScope.HOOK,
  //     `${CacheScope.HOOK}:${hookId}`,
  //     CacheDelDirection.CHILD_TO_PARENT
  //   );
  //   return await ncMeta.metaDelete(null, null, MetaTable.HOOKS, hookId);
  // }
}
