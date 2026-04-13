import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  DependencyTableType,
  EventType,
  generateUniqueCopyName,
  PlanLimitTypes,
} from 'nocodb-sdk';
import type { OnModuleInit } from '@nestjs/common';
import type { BaseTrashType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import BaseTrash from '~/models/BaseTrash';
import Model from '~/models/Model';
import View from '~/models/View';
import {
  Dashboard,
  DependencyTracker,
  Extension,
  Script,
  Widget,
  Workflow,
} from '~/models';
import { NcBaseError, NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { TablesService } from '~/services/tables.service';
import { JobTypes } from '~/interface/Jobs';

interface TrashableResourceConfig<T = any, P = any> {
  get: (ctx: NcContext, id: string) => Promise<T | null>;
  softDelete: (
    ctx: NcContext,
    id: string,
    deleted: boolean,
    ncMeta?: any,
  ) => Promise<void>;
  delete: (ctx: NcContext, id: string) => Promise<any>;
  parentType?: BaseTrashType['resource_type'];
  getParentId?: (entity: T) => string;
  getParent?: (ctx: NcContext, id: string) => Promise<P | null>;
  childTypes?: string[];
  preDelete?: (ctx: NcContext, id: string) => Promise<void>;
  socketEvent?: EventType;
  /** Socket action prefix for META_EVENT (e.g. 'extension' → 'extension_restore') */
  socketActionPrefix?: string;
  /** Plan limit type for restore validation (e.g. LIMIT_DASHBOARD_PER_WORKSPACE) */
  planLimitType?: PlanLimitTypes;
  /** Get existing entity names for dedup on restore */
  getExistingNames?: (ctx: NcContext, entity: T) => Promise<string[]>;
  /** Update entity title (for rename on restore) */
  updateTitle?: (
    ctx: NcContext,
    id: string,
    title: string,
    ncMeta?: any,
  ) => Promise<any>;
}

const TRASHABLE_RESOURCE_CONFIGS: {
  view: TrashableResourceConfig<View, Model>;
  dashboard: TrashableResourceConfig<Dashboard>;
  widget: TrashableResourceConfig<Widget, Dashboard>;
  workflow: TrashableResourceConfig<Workflow>;
  script: TrashableResourceConfig<Script>;
  extension: TrashableResourceConfig<Extension>;
} = {
  view: {
    get: (ctx, id) => View.get(ctx, id),
    softDelete: (ctx, id, deleted, ncMeta) =>
      View.softDelete(ctx, id, deleted, ncMeta),
    delete: (ctx, id) => View.delete(ctx, id),
    socketEvent: EventType.META_EVENT,
    socketActionPrefix: 'view',
    parentType: 'table',
    getParentId: (e) => e.fk_model_id,
    getParent: (ctx, id) => Model.getByIdOrName(ctx, { id }),
    async getExistingNames(ctx, entity) {
      const views = await View.list(ctx, entity.fk_model_id);
      return views.map((v) => v.title);
    },
    updateTitle: (ctx, id, title, ncMeta) =>
      View.update(ctx, id, { title }, ncMeta),
  },
  dashboard: {
    get: (ctx, id) => Dashboard.get(ctx, id),
    softDelete: (ctx, id, deleted, ncMeta) =>
      Dashboard.softDelete(ctx, id, deleted, ncMeta),
    delete: (ctx, id) => Dashboard.delete(ctx, id),
    socketEvent: EventType.DASHBOARD_EVENT,
    childTypes: ['widget'],
    planLimitType: PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
    async getExistingNames(ctx) {
      const list = await Dashboard.list(ctx, ctx.base_id);
      return list.map((d) => d.title);
    },
    updateTitle: (ctx, id, title, ncMeta) =>
      Dashboard.update(ctx, id, { title }, ncMeta),
  },
  widget: {
    get: (ctx, id) => Widget.get(ctx, id),
    softDelete: (ctx, id, deleted, ncMeta) =>
      Widget.softDelete(ctx, id, deleted, ncMeta),
    delete: (ctx, id) => Widget.delete(ctx, id),
    socketEvent: EventType.WIDGET_EVENT,
    parentType: 'dashboard',
    getParentId: (e) => (e as any).fk_dashboard_id,
    getParent: (ctx, id) => Dashboard.get(ctx, id),
    async preDelete(ctx, id) {
      await DependencyTracker.clearDependencies(
        ctx,
        DependencyTableType.Widget,
        id,
      );
    },
  } as TrashableResourceConfig<Widget, Dashboard>,
  workflow: {
    get: (ctx, id) => Workflow.get(ctx, id),
    softDelete: (ctx, id, deleted, ncMeta) =>
      Workflow.softDelete(ctx, id, deleted, ncMeta),
    delete: (ctx, id) => Workflow.delete(ctx, id),
    socketEvent: EventType.WORKFLOW_EVENT,
    async preDelete(ctx, id) {
      await DependencyTracker.clearDependencies(
        ctx,
        DependencyTableType.Workflow,
        id,
      );
    },
    async getExistingNames(ctx) {
      const list = await Workflow.list(ctx, ctx.base_id);
      return list.map((w) => w.title);
    },
    updateTitle: (ctx, id, title, ncMeta) =>
      Workflow.update(ctx, id, { title }, ncMeta),
  },
  script: {
    get: (ctx, id) => Script.get(ctx, id),
    softDelete: (ctx, id, deleted, ncMeta) =>
      Script.softDelete(ctx, id, deleted, ncMeta),
    delete: (ctx, id) => Script.delete(ctx, id),
    socketEvent: EventType.SCRIPT_EVENT,
    planLimitType: PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
    async getExistingNames(ctx) {
      const list = await Script.list(ctx, ctx.base_id);
      return list.map((s) => s.title);
    },
    updateTitle: (ctx, id, title, ncMeta) =>
      Script.update(ctx, id, { title }, ncMeta),
  },
  extension: {
    get: (ctx, id) => Extension.get(ctx, id),
    softDelete: (ctx, id, deleted, ncMeta) =>
      Extension.softDelete(ctx, id, deleted, ncMeta),
    delete: (ctx, id) => Extension.delete(ctx, id),
    socketEvent: EventType.META_EVENT,
    socketActionPrefix: 'extension',
    planLimitType: PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE,
    async getExistingNames(ctx) {
      const list = await Extension.list(ctx, ctx.base_id);
      return list.map((e) => e.title);
    },
    updateTitle: (ctx, id, title, ncMeta) =>
      Extension.update(ctx, id, { title }, ncMeta),
  },
};

@Injectable()
export class BaseTrashService implements OnModuleInit {
  protected logger = new Logger(BaseTrashService.name);

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly tablesService: TablesService,
  ) {}

  async onModuleInit() {
    this.nocoJobsService.jobsQueue.add(
      {
        jobName: JobTypes.BaseTrashCleanUp,
      },
      {
        jobId: JobTypes.BaseTrashCleanUp,
        repeat: { cron: '*/2 * * * *' }, // every 2 minutes
      },
    );
  }

  async getRetentionDays(_workspaceId: string): Promise<number> {
    return parseInt(process.env.NC_TRASH_RETENTION_DAYS || '30', 10);
  }

  async checkRestoreLimit(
    _context: NcContext,
    _config: TrashableResourceConfig,
  ): Promise<void> {}

  private getResourceConfig(resourceType: string): TrashableResourceConfig {
    const config =
      TRASHABLE_RESOURCE_CONFIGS[
        resourceType as keyof typeof TRASHABLE_RESOURCE_CONFIGS
      ];
    if (!config) {
      NcError.badRequest(
        `Unsupported resource type for trash: ${resourceType}`,
      );
    }
    return config;
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

  /**
   * Generic soft-delete for view, dashboard, widget, workflow, script.
   */
  async trashResource(
    context: NcContext,
    param: {
      resourceId: string;
      resourceType: string;
      user: Partial<UserType>;
      req: NcRequest;
      ncMeta?: any;
    },
  ) {
    const config = this.getResourceConfig(param.resourceType);

    const entity = await config.get(context, param.resourceId);
    if (!entity) {
      NcError.get(context).genericNotFound(
        param.resourceType,
        param.resourceId,
      );
    }

    let parentName: string | undefined;
    if (config.parentType && config.getParentId) {
      const parentId = config.getParentId(entity);
      if (parentId && config.getParent) {
        const parent = await config.getParent(context, parentId);
        parentName = parent?.title;
      }
    }

    const retentionDays = await this.getRetentionDays(context.workspace_id);
    const deletedAt = new Date();
    const cleanupDueAt = new Date(deletedAt);
    cleanupDueAt.setDate(cleanupDueAt.getDate() + retentionDays);

    const useExternalTx = !!param.ncMeta;
    const ncMeta =
      param.ncMeta || (await (Noco.ncMeta as MetaService).startTransaction());

    try {
      await config.softDelete(context, param.resourceId, true, ncMeta);

      // Build resource-specific meta for UI rendering
      const trashMeta: Record<string, any> = {};
      if (param.resourceType === 'view') {
        const view = entity as View;
        if (view.type != null) trashMeta.viewType = view.type;
        if (view.meta != null) trashMeta.viewMeta = view.meta;
      }

      await BaseTrash.insert(
        context,
        {
          fk_workspace_id: context.workspace_id,
          base_id: entity.base_id,
          resource_type: param.resourceType as BaseTrashType['resource_type'],
          resource_id: entity.id,
          name: entity.title,
          deleted_by: param.user.id,
          deleted_at: deletedAt.toISOString(),
          cleanup_due_at: cleanupDueAt.toISOString(),
          ...(config.parentType && config.getParentId
            ? {
                parent_type: config.parentType,
                parent_id: config.getParentId(entity),
                parent_name: parentName,
              }
            : {}),
          ...(Object.keys(trashMeta).length ? { meta: trashMeta } : {}),
        },
        ncMeta,
      );

      if (!useExternalTx) await ncMeta.commit();
    } catch (e) {
      if (!useExternalTx) await ncMeta.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e.message, e.stack);
      NcError.get(context).internalServerError('Cannot trash resource');
    }

    return true;
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
    const config = this.getResourceConfig(trashEntry.resource_type);

    // Check if parent is trashed
    if (trashEntry.parent_id && trashEntry.parent_type) {
      let parent: any;
      if (trashEntry.parent_type === 'table') {
        // Tables are not in TRASHABLE_RESOURCE_CONFIGS — use Model.get directly
        parent = await Model.get(context, trashEntry.parent_id);
      } else {
        const parentConfig = this.getResourceConfig(trashEntry.parent_type);
        parent = await parentConfig.get(context, trashEntry.parent_id);
      }
      if (!parent) {
        NcError.get(context).parentInTrash(trashEntry.parent_type);
      }
    }

    // Check plan limit before restoring (EE overrides this)
    await this.checkRestoreLimit(context, config);

    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();

    try {
      // Dedup name if collision exists
      if (trashEntry.name && config.getExistingNames && config.updateTitle) {
        // Build a minimal entity with fields needed by getExistingNames
        // (the real entity is soft-deleted so config.get returns null)
        const entityStub = {
          title: trashEntry.name,
          fk_model_id: trashEntry.parent_id,
          fk_dashboard_id: trashEntry.parent_id,
        };
        const existingNames = await config.getExistingNames(
          context,
          entityStub,
        );

        if (existingNames.includes(trashEntry.name)) {
          const newTitle = generateUniqueCopyName(
            trashEntry.name,
            existingNames,
          );
          await config.updateTitle(
            context,
            trashEntry.resource_id,
            newTitle,
            ncMeta,
          );
        }
      }

      await config.softDelete(context, trashEntry.resource_id, false, ncMeta);
      await BaseTrash.delete(context, trashEntry.id, ncMeta);
      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e.message, e.stack);
      throw e;
    }

    this.appHooksService.emit(AppEvents.RESOURCE_RESTORE, {
      resourceType: trashEntry.resource_type,
      resourceId: trashEntry.resource_id,
      name: trashEntry.name,
      user: param.user,
      context,
      req: param.req,
    });

    if (config.socketEvent) {
      const restoredEntity = await config.get(context, trashEntry.resource_id);

      const action = config.socketActionPrefix
        ? `${config.socketActionPrefix}_restore`
        : 'restore';

      NocoSocket.broadcastEvent(context, {
        event: config.socketEvent,
        payload: {
          id: trashEntry.resource_id,
          action,
          payload: restoredEntity,
        } as Record<string, unknown>,
      } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
    }

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

    const config = this.getResourceConfig(trashEntry.resource_type);

    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();

    try {
      // Clean up child trash entries (e.g. dashboard → widget trash entries)
      if (config.childTypes?.length) {
        for (const childType of config.childTypes) {
          const childTrash = await BaseTrash.list(
            context,
            {
              base_id: context.base_id,
              resourceType: childType,
              parentId: trashEntry.resource_id,
              limit: 1000,
            },
            ncMeta,
          );
          for (const child of childTrash) {
            await BaseTrash.delete(context, child.id, ncMeta);
          }
        }
      }

      // Pre-delete cleanup (e.g. clear dependencies)
      if (config.preDelete) {
        await config.preDelete(context, trashEntry.resource_id);
      }

      // Restore temporarily so the model's delete() can run full cleanup
      await config.softDelete(context, trashEntry.resource_id, false);

      await config.delete(context, trashEntry.resource_id);
      await BaseTrash.delete(context, trashEntry.id, ncMeta);

      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e.message, e.stack);
      throw e;
    }

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
    const allTrash = await BaseTrash.list(context, {
      base_id: param.baseId,
      limit: 1000,
    });

    for (const entry of allTrash) {
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

    return true;
  }
}
