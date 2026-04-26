import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { ButtonColumn, Hook, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';

/**
 * When a webhook is deleted (trashed or hard-deleted), button columns that
 * pinned `fk_webhook_id` to that hook are now broken. Null the FK and stamp
 * an `error` so the button surfaces as misconfigured. Restoring a trashed
 * hook does NOT auto-relink — buttons stay disconnected and the user has
 * to re-pick the webhook (matches the script-trash pattern).
 *
 * Param shape: `oldEntity = { id, fk_model_id }` of the deleted hook.
 */
@Injectable()
export class HookDeleteButtonRefDependencyHandler implements MetaEventHandler {
  private readonly logger = new Logger(
    HookDeleteButtonRefDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.HOOK_DELETED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.oldEntity?.id;
    if (!id) return undefined;

    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_BUTTON,
      { condition: { fk_webhook_id: id }, limit: 1 },
    );
    return rows.length ? {} : undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const oldHook = param.oldEntity;
    if (!oldHook?.id) return;

    const buttonCols = await Hook.hookUsages(context, oldHook.id, ncMeta);
    if (!buttonCols.length) return;

    for (const button of buttonCols) {
      await ButtonColumn.update(
        context,
        button.fk_column_id,
        {
          fk_webhook_id: null,
          error: 'Webhook has been moved to trash',
        },
        ncMeta,
      );
    }

    if (oldHook.fk_model_id) {
      await View.clearSingleQueryCache(
        context,
        oldHook.fk_model_id,
        null,
        ncMeta,
      );
    }

    // Realtime: notify clients showing the table that button columns changed.
    this.broadcastColumnUpdate(context, oldHook.fk_model_id).catch((e) =>
      this.logger.error(
        `Failed to broadcast column_update for hook delete: ${e?.message}`,
        e?.stack,
      ),
    );
  }

  private async broadcastColumnUpdate(
    context: NcContext,
    fkModelId: string | undefined,
  ): Promise<void> {
    if (!fkModelId) return;
    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_update',
          payload: {
            table: { id: fkModelId },
            column: {},
            skipDataReload: true,
          },
        },
      } as Parameters<typeof NocoSocket.broadcastEvent>[1],
      context.socket_id,
    );
  }
}
