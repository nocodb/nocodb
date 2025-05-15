import type { HookLogType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Hook from '~/models/Hook';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';
import { isOnPrem } from '~/utils';

export default class HookLog implements HookLogType {
  id?: string;
  source_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_hook_id?: string;
  type?: string;
  event?: HookLogType['event'];
  operation?: HookLogType['operation'];
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
    context: NcContext,
    param: {
      fk_hook_id: string;
      event?: HookLogType['event'];
      operation?: HookLogType['operation'];
    },
    {
      limit = 25,
      offset = 0,
    }: {
      limit?: number;
      offset?: number;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const hookLogs = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOK_LOGS,
      {
        condition: {
          fk_hook_id: param.fk_hook_id,
        },
        ...(process.env.NC_AUTOMATION_LOG_LEVEL === 'ERROR' && {
          xcCondition: {
            error_message: {
              neq: null,
            },
          },
        }),
        orderBy: {
          created_at: 'desc',
        },
        limit,
        offset,
      },
    );
    return hookLogs?.map((h) => new HookLog(h));
  }

  public static async insert(
    context: NcContext,
    hookLog: Partial<HookLog>,
    ncMeta = Noco.ncMeta,
  ) {
    if (process.env.NC_AUTOMATION_LOG_LEVEL === 'OFF') {
      return;
    }
    const insertObj: any = extractProps(hookLog, [
      'source_id',
      'base_id',
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

    const hook = await Hook.get(context, hookLog.fk_hook_id, ncMeta);

    if (!hookLog.source_id) {
      insertObj.source_id = hook.source_id;
    }

    if (typeof insertObj.notification === 'object') {
      insertObj.notification = JSON.stringify(insertObj.notification);
    }

    insertObj.execution_time = parseInt(insertObj.execution_time) || 0;

    return await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOK_LOGS,
      insertObj,
    );
  }

  public static async count(
    context: NcContext,
    { hookId }: { hookId?: string },
    ncMeta = Noco.ncMeta,
  ) {
    const qb = ncMeta.knex(MetaTable.HOOK_LOGS);

    if (hookId) {
      qb.where(`${MetaTable.HOOK_LOGS}.fk_hook_id`, hookId);
    }

    if (
      process.env.NC_AUTOMATION_LOG_LEVEL === 'ERROR' ||
      (isOnPrem && process.env.NC_AUTOMATION_LOG_LEVEL !== 'OFF')
    ) {
      qb.whereNotNull(`${MetaTable.HOOK_LOGS}.error_message`);
    }

    return (await qb.count('id', { as: 'count' }).first())?.count ?? 0;
  }
}
