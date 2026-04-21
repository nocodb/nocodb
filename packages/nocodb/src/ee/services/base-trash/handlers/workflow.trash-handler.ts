import { Injectable } from '@nestjs/common';
import {
  DependencyTableType,
  EventType,
  generateUniqueCopyName,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '~/services/base-trash/types';
import { DependencyTracker, Workflow } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class WorkflowTrashHandler implements TrashHandler<Workflow> {
  resourceType = 'workflow';

  async trash(ctx: NcContext, id: string): Promise<TrashResult<Workflow>> {
    const workflow = await Workflow.get(ctx, id);
    if (!workflow) {
      NcError.get(ctx).workflowNotFound(id);
    }

    await Workflow.softDelete(ctx, id, true);

    return { entity: workflow };
  }

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    if (trashEntry.name) {
      const list = await Workflow.list(ctx, ctx.base_id);
      const existingNames = list.map((w) => w.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(
          trashEntry.name,
          existingNames,
          {
            prefix: 'Restored',
          },
        );
        await Workflow.update(ctx, trashEntry.resource_id, {
          title: newTitle,
        });
      }
    }

    await Workflow.softDelete(ctx, trashEntry.resource_id, false);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.WORKFLOW_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'restore',
        payload: await Workflow.get(ctx, trashEntry.resource_id),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    await DependencyTracker.clearDependencies(
      ctx,
      DependencyTableType.Workflow,
      trashEntry.resource_id,
    );
    await Workflow.softDelete(ctx, trashEntry.resource_id, false);
    await Workflow.delete(ctx, trashEntry.resource_id);
  }
}
