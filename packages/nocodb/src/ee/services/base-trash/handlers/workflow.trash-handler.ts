import { Injectable } from '@nestjs/common';
import {
  DependencyTableType,
  EventType,
  generateUniqueCopyName,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { MetaService } from '~/meta/meta.service';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { DependencyTracker, Workflow } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class WorkflowTrashHandler extends BaseTrashHandler<Workflow> {
  resourceType = 'workflow';
  affectedCaches = ['commandPalette'] as const;

  async trash(
    ctx: NcContext,
    id: string,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Workflow>> {
    const workflow = await Workflow.get(ctx, id, false, ncMeta);
    if (!workflow) {
      NcError.get(ctx).workflowNotFound(id);
    }

    await Workflow.softDelete(ctx, id, true, ncMeta);

    return { entity: workflow };
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    if (trashEntry.name) {
      const list = await Workflow.list(ctx, ctx.base_id, false, ncMeta);
      const existingNames = list.map((w) => w.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(
          trashEntry.name,
          existingNames,
          {
            prefix: 'Restored',
          },
        );
        await Workflow.update(
          ctx,
          trashEntry.resource_id,
          { title: newTitle },
          ncMeta,
        );
      }
    }

    await Workflow.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.WORKFLOW_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'restore',
        payload: await Workflow.get(ctx, trashEntry.resource_id, false, ncMeta),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    await DependencyTracker.clearDependencies(
      ctx,
      DependencyTableType.Workflow,
      trashEntry.resource_id,
      ncMeta,
    );
    await Workflow.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    await Workflow.delete(ctx, trashEntry.resource_id, ncMeta);
  }
}
