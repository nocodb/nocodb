import { MetaTable } from '../utils/globals';
import Noco from '../Noco';
import { extractProps } from '../meta/helpers/extractProps';
import Hook from './Hook';
import type { HookLogType } from 'nocodb-sdk';

export default class HookLog implements HookLogType {
  id?: string;
  base_id?: string;
  project_id?: string;
  fk_hook_id?: string;
  type?: string;
  event?: 'after' | 'before';
  operation?: 'insert' | 'update' | 'delete';
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

  constructor(hookLog: Partial<HookLog>) {
    Object.assign(this, hookLog);
  }

  static async list(
    param: {
      fk_hook_id: string;
      event?: 'after' | 'before';
      operation?: 'insert' | 'delete' | 'update';
    },
    ncMeta = Noco.ncMeta
  ) {
    const hookLogs = await ncMeta.metaList(null, null, MetaTable.HOOK_LOGS, {
      condition: {
        fk_hook_id: param.fk_hook_id,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    return hookLogs?.map((h) => new HookLog(h));
  }

  public static async insert(hookLog: Partial<HookLog>, ncMeta = Noco.ncMeta) {
    const insertObj: any = extractProps(hookLog, [
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
      'triggered_by',
    ]);

    if (!(hookLog.project_id && hookLog.base_id) && hookLog.fk_hook_id) {
      const hook = await Hook.get(hookLog.fk_hook_id, ncMeta);
      insertObj.project_id = hook.project_id;
      insertObj.base_id = hook.base_id;
    }

    if (typeof insertObj.notification === 'object') {
      insertObj.notification = JSON.stringify(insertObj.notification);
    }

    insertObj.execution_time = parseInt(insertObj.execution_time) || 0;

    return await ncMeta.metaInsert2(null, null, MetaTable.HOOK_LOGS, insertObj);
  }
}
