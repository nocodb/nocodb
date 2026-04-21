import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppEvents, PlanLimitTypes } from 'nocodb-sdk';
import { TRASH_HANDLER_TOKEN } from '~/services/base-trash/types';
import type { OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type { TrashHandler } from '~/services/base-trash/types';
import BaseTrash from '~/models/BaseTrash';
import Model from '~/models/Model';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobTypes } from '~/interface/Jobs';
import { getLimit } from '~/helpers/paymentHelpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class BaseTrashService implements OnModuleInit {
  protected logger = new Logger(BaseTrashService.name);
  protected handlerMap = new Map<string, TrashHandler>();

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly nocoJobsService: NocoJobsService,
    @Inject(TRASH_HANDLER_TOKEN) handlers: TrashHandler[],
  ) {
    for (const handler of handlers) {
      this.handlerMap.set(handler.resourceType, handler);
    }
  }

  async onModuleInit() {
    this.nocoJobsService.jobsQueue.add(
      { jobName: JobTypes.BaseTrashCleanUp },
      {
        jobId: JobTypes.BaseTrashCleanUp,
        repeat: { cron: '*/2 * * * *' },
      },
    );
  }

  async getRetentionDays(workspaceId: string): Promise<number> {
    try {
      const { limit } = await getLimit(
        PlanLimitTypes.LIMIT_TRASH_RETENTION,
        workspaceId,
      );
      if (limit && limit !== Infinity) {
        return limit;
      }
    } catch {
      // Fall through to default
    }

    return parseInt(process.env.NC_TRASH_RETENTION_DAYS || '30', 10);
  }

  async checkRestoreLimit(
    context: NcContext,
    resourceType: string,
    trashEntry: BaseTrash,
  ): Promise<void> {
    if (resourceType === 'table') {
      await this.checkTableRestoreLimit(context, trashEntry.resource_id);
    } else if (resourceType === 'view') {
      await this.checkViewRestoreLimit(context, trashEntry.parent_id);
    } else if (resourceType === 'field') {
      await this.checkFieldRestoreLimit(context, trashEntry.parent_id);
    }
  }

  protected getHandler(resourceType: string): TrashHandler {
    const handler = this.handlerMap.get(resourceType);
    if (!handler) {
      NcError.badRequest(
        `Unsupported resource type for trash: ${resourceType}`,
      );
    }
    return handler;
  }

  async trashList(
    context: NcContext,
    param: {
      baseId: string;
      resourceType?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const list = await BaseTrash.list(context, {
      base_id: param.baseId,
      resourceType: param.resourceType,
      limit: param.limit,
      offset: param.offset,
    });

    const count = await BaseTrash.count(context, {
      base_id: param.baseId,
      resourceType: param.resourceType,
    });

    return {
      list,
      pageInfo: {
        totalRows: count,
        page: Math.floor((param.offset || 0) / (param.limit || 25)) + 1,
        pageSize: param.limit || 25,
        isLastPage: (param.offset || 0) + (param.limit || 25) >= count,
      },
    };
  }

  private async insertTrashEntry(
    context: NcContext,
    param: {
      resourceType: string;
      user: Partial<UserType>;
      ncMeta?: MetaService;
    },
    result: Awaited<ReturnType<TrashHandler['trash']>>,
  ) {
    const retentionDays = await this.getRetentionDays(context.workspace_id);
    const deletedAt = new Date();
    const cleanupDueAt = new Date(deletedAt);
    cleanupDueAt.setDate(cleanupDueAt.getDate() + retentionDays);

    await BaseTrash.insert(
      context,
      {
        fk_workspace_id: context.workspace_id,
        base_id: result.entity.base_id,
        resource_type: param.resourceType as BaseTrash['resource_type'],
        resource_id: result.entity.id,
        name: result.entity.title,
        deleted_by: param.user.id,
        deleted_at: deletedAt.toISOString(),
        cleanup_due_at: cleanupDueAt.toISOString(),
        ...(result.parentType
          ? {
              parent_type: result.parentType,
              parent_id: result.parentId,
              parent_name: result.parentName,
            }
          : {}),
        ...(result.relatedItems
          ? { related_items: JSON.stringify(result.relatedItems) }
          : {}),
        ...(result.meta ? { meta: result.meta } : {}),
      },
      param.ncMeta,
    );
  }

  async trashResource(
    context: NcContext,
    param: {
      resourceId: string;
      resourceType: string;
      user: Partial<UserType>;
      req: NcRequest;
      ncMeta?: MetaService;
    },
  ) {
    const handler = this.getHandler(param.resourceType);
    const result = await handler.trash(context, param.resourceId, param.ncMeta);
    if (!result.skipTrashEntry) {
      await this.insertTrashEntry(context, param, result);
    }
    return true;
  }

  async trashTable(
    context: NcContext,
    param: {
      tableId: string;
      user: Partial<UserType>;
      req: NcRequest;
    },
  ) {
    return this.trashResource(context, {
      resourceId: param.tableId,
      resourceType: 'table',
      user: param.user,
      req: param.req,
    });
  }

  async restore(
    context: NcContext,
    param: {
      trashId: string;
      user: Partial<UserType>;
      req: NcRequest;
    },
  ) {
    const trashEntry = await BaseTrash.get(context, param.trashId);
    if (!trashEntry) {
      NcError.get(context).trashNotFound(param.trashId);
    }

    await this.checkRestoreLimit(context, trashEntry.resource_type, trashEntry);

    const handler = this.getHandler(trashEntry.resource_type);
    await handler.restore(context, trashEntry);
    await BaseTrash.delete(context, trashEntry.id);

    this.appHooksService.emit(AppEvents.RESOURCE_RESTORE, {
      resourceType: trashEntry.resource_type,
      resourceId: trashEntry.resource_id,
      name: trashEntry.name,
      user: param.user,
      context,
      req: param.req,
    });

    return true;
  }

  async permanentDelete(
    context: NcContext,
    param: {
      trashId: string;
      user: Partial<UserType>;
      req: NcRequest;
    },
  ) {
    const trashEntry = await BaseTrash.get(context, param.trashId);
    if (!trashEntry) {
      NcError.get(context).trashNotFound(param.trashId);
    }

    const handler = this.getHandler(trashEntry.resource_type);

    // Clean up child trash entries (e.g. dashboard → widget)
    if (handler.childTypes?.length) {
      for (const childType of handler.childTypes) {
        const childTrash = await BaseTrash.list(context, {
          base_id: context.base_id,
          resourceType: childType,
          parentId: trashEntry.resource_id,
          limit: 1000,
        });
        for (const child of childTrash) {
          await BaseTrash.delete(context, child.id);
        }
      }
    }

    await handler.permanentDelete(context, trashEntry);
    await BaseTrash.delete(context, trashEntry.id);

    this.appHooksService.emit(AppEvents.RESOURCE_PERMANENT_DELETE, {
      resourceType: trashEntry.resource_type,
      resourceId: trashEntry.resource_id,
      name: trashEntry.name,
      user: param.user,
      context,
      req: param.req,
    });

    return true;
  }

  async emptyTrash(
    context: NcContext,
    param: {
      baseId: string;
      user: Partial<UserType>;
      req: NcRequest;
    },
  ) {
    const batchSize = 100;
    let batch: BaseTrash[];

    do {
      batch = await BaseTrash.list(context, {
        base_id: param.baseId,
        limit: batchSize,
      });

      for (const entry of batch) {
        try {
          await this.permanentDelete(context, {
            trashId: entry.id,
            user: param.user,
            req: param.req,
          });
        } catch (e) {
          this.logger.error(
            `Failed to permanently delete trash entry ${entry.id}: ${e.message}`,
            e.stack,
          );
        }
      }
    } while (batch.length === batchSize);

    return true;
  }

  private async checkTableRestoreLimit(
    context: NcContext,
    tableId: string,
  ): Promise<void> {
    const table = await Model.get(context, tableId, true);
    if (!table) return;

    const tablesInBase = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        condition: { source_id: table.source_id },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    const { limit, plan } = await getLimit(
      PlanLimitTypes.LIMIT_TABLE_PER_BASE,
      context.workspace_id,
    );

    if (limit !== Infinity && tablesInBase >= limit) {
      NcError.planLimitExceeded(
        `Cannot restore — you have reached the limit of ${limit} tables for your plan. Upgrade to restore this table.`,
        { plan: plan?.title, limit, current: tablesInBase },
      );
    }
  }

  private async checkViewRestoreLimit(
    context: NcContext,
    tableId: string,
  ): Promise<void> {
    if (!tableId) return;

    const viewsInTable = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        condition: { fk_model_id: tableId },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    const { limit, plan } = await getLimit(
      PlanLimitTypes.LIMIT_VIEW_PER_TABLE,
      context.workspace_id,
    );

    if (limit !== Infinity && viewsInTable >= limit) {
      NcError.planLimitExceeded(
        `Cannot restore — you have reached the limit of ${limit} views for your plan. Upgrade to restore this view.`,
        { plan: plan?.title, limit, current: viewsInTable },
      );
    }
  }

  private async checkFieldRestoreLimit(
    context: NcContext,
    tableId: string,
  ): Promise<void> {
    if (!tableId) return;

    const columnsInTable = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        condition: { fk_model_id: tableId },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    const { limit, plan } = await getLimit(
      PlanLimitTypes.LIMIT_COLUMN_PER_TABLE,
      context.workspace_id,
    );

    if (limit !== Infinity && columnsInTable >= limit) {
      NcError.planLimitExceeded(
        `Cannot restore — you have reached the limit of ${limit} fields for your plan. Upgrade to restore this field.`,
        { plan: plan?.title, limit, current: columnsInTable },
      );
    }
  }
}
