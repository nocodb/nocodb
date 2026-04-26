import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  ncHasProperties,
  PlanLimitTypes,
  ProjectRoles,
} from 'nocodb-sdk';
import type { OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type {
  TrashHandler,
  TrashLifecycleResult,
} from '~/services/base-trash/types';
import { TRASH_HANDLER_TOKEN } from '~/services/base-trash/types';
import BaseTrash from '~/models/BaseTrash';
import { NcBaseError, NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobTypes } from '~/interface/Jobs';
import { getLimit } from '~/helpers/paymentHelpers';
import { processConcurrently } from '~/utils/dataUtils';
import Noco from '~/Noco';

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
    await this.nocoJobsService.jobsQueue.removeRepeatable({
      jobId: JobTypes.BaseTrashCleanUp,
      cron: '*/10 * * * *',
    });
    this.nocoJobsService.jobsQueue.add(
      { jobName: JobTypes.BaseTrashCleanUp },
      {
        jobId: JobTypes.BaseTrashCleanUp,
        repeat: { cron: '*/10 * * * *' },
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

    const raw = process.env.NC_TRASH_RETENTION_DAYS;
    if (raw === undefined || raw === '') return 30;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
    this.logger.warn(
      `Ignoring invalid NC_TRASH_RETENTION_DAYS=${JSON.stringify(
        raw,
      )} — falling back to 30 days`,
    );
    return 30;
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
      cursor?: string | null;
      roles?: Record<string, boolean> | null;
    },
  ) {
    const { list: rawList, nextCursor } = await BaseTrash.list(context, {
      base_id: param.baseId,
      resourceType: param.resourceType,
      limit: param.limit,
      cursor: param.cursor,
    });

   const isCreatorOrOwner = (() => {
      if (!param.roles) return true; // no role info → assume allowed; the restore call will gate
      const obj = extractRolesObj(param.roles);
      return !!obj?.[ProjectRoles.CREATOR] || !!obj?.[ProjectRoles.OWNER];
    })();
    for (const entry of rawList) {
      entry.is_restorable =
        entry.resource_type === 'record' || isCreatorOrOwner;
    }

    const enriched = await processConcurrently(rawList, async (entry) => {
      const handler = this.handlerMap.get(entry.resource_type);
      if (!handler?.enrich) return entry;

      try {
        const enrichment = await handler.enrich(context, entry);
        if ('drop' in enrichment) return null; // hide
        return { ...entry, ...enrichment.extra };
      } catch (e) {
        this.logger.error(
          `Failed to enrich ${entry.resource_type} trash entry ${entry.id}: ${e?.message}`,
          e?.stack,
        );
        return entry;
      }
    });

    const list = enriched.filter((e) => e !== null);

    return { list, nextCursor };
  }

  private async insertTrashEntry(
    context: NcContext,
    param: {
      resourceType: string;
      user: Partial<UserType>;
      ncMeta?: MetaService;
      deletedAt?: string;
      cleanupDueAt?: string;
    },
    result: Awaited<ReturnType<TrashHandler['trash']>>,
  ) {
    const retentionDays = await this.getRetentionDays(context.workspace_id);
    const deletedAt = param.deletedAt ? new Date(param.deletedAt) : new Date();
    const cleanupDueAt = param.cleanupDueAt
      ? new Date(param.cleanupDueAt)
      : (() => {
          const due = new Date(deletedAt);
          due.setDate(due.getDate() + retentionDays);
          return due;
        })();

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
      deletedAt?: string;
      cleanupDueAt?: string;
    },
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const handler = this.getHandler(param.resourceType);

    const ncMeta = param.ncMeta
      ? param.ncMeta
      : await (Noco.ncMeta as MetaService).startTransaction();

    try {
      const result = await handler.trash(
        context,
        param.resourceId,
        { user: param.user, req: param.req },
        ncMeta,
      );
      if (!result.skipTrashEntry) {
        await this.insertTrashEntry(context, { ...param, ncMeta }, result);
      }
      if (!param.ncMeta) await ncMeta.commit();
      handler.invalidateCaches(
        context.workspace_id,
        result.entity?.base_id ?? context.base_id,
      );
      return true;
    } catch (e) {
      if (!param.ncMeta) await ncMeta.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e.message, e.stack);
      NcError.get(context).internalServerError(
        `Failed to trash ${param.resourceType}`,
      );
    }
  }

  async restore(
    context: NcContext,
    param: {
      trashId: string;
      user: Partial<UserType>;
      req: NcRequest;
      /**
       * Conflict-resolution flag for `record` entries — pass-through to
       * `RecordTrashHandler.restore`. Other resource types ignore it.
       *   force:   auto-resolve every conflict by nulling offending columns
       *   partial: skip conflicting rows; leave them in trash
       */
      force?: boolean;
      partial?: boolean;
    },
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const trashEntry = await BaseTrash.get(context, param.trashId);
    if (!trashEntry) {
      NcError.get(context).trashNotFound(param.trashId);
    }

    const handler = this.getHandler(trashEntry.resource_type);

    // Resource-type role gate. ACL allows EDITOR+ to invoke baseTrashRestore
    // (so editors can undo their own row deletes), but restoring a non-record
    // entry — table / view / field / dashboard / widget / workflow / script —
    // is structural and requires CREATOR+. Records remain editor-restorable
    // because soft-delete + restore is part of the normal data-edit loop.
    if (trashEntry.resource_type !== 'record') {
      const baseRoles = extractRolesObj(param.req?.user?.base_roles);
      const isCreatorOrOwner =
        !!baseRoles?.[ProjectRoles.CREATOR] ||
        !!baseRoles?.[ProjectRoles.OWNER];
      if (!isCreatorOrOwner) {
        NcError.get(context).forbidden(
          `Restoring a ${trashEntry.resource_type} requires creator or owner role`,
        );
      }
    }

    await handler.checkRestoreLimit?.(context, trashEntry);

    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();
    try {
      const lifecycle = await handler.restore(
        context,
        trashEntry,
        {
          user: param.user,
          req: param.req,
          force: param.force,
          partial: param.partial,
        },
        ncMeta,
      );
      // Handlers (e.g. record handler) can ask the entry to survive when the
      // restore only affected a subset of the underlying records (RLS-bounded
      // user pass, or a partial restore where conflicts kept some rows).
      const keepEntry =
        ncHasProperties<TrashLifecycleResult>(lifecycle, 'keepEntry') &&
        !!lifecycle.keepEntry;
      if (!keepEntry) {
        await BaseTrash.delete(context, trashEntry.id, ncMeta);
      }
      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e.message, e.stack);
      NcError.get(context).internalServerError('Failed to restore');
    }

    handler.invalidateCaches(
      context.workspace_id,
      trashEntry.base_id ?? context.base_id,
    );

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
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const trashEntry = await BaseTrash.get(context, param.trashId);
    if (!trashEntry) {
      NcError.get(context).trashNotFound(param.trashId);
    }

    const handler = this.getHandler(trashEntry.resource_type);

    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();
    try {
      // Clean up child trash entries (e.g. dashboard → widget, table → view/field).
      if (handler.childTypes?.length) {
        const CHILD_CLEANUP_BATCH = 100;
        for (const childType of handler.childTypes) {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { list: childTrash } = await BaseTrash.list(
              context,
              {
                base_id: context.base_id,
                resourceType: childType,
                parentId: trashEntry.resource_id,
                limit: CHILD_CLEANUP_BATCH,
              },
              ncMeta,
            );
            if (!childTrash.length) break;
            for (const child of childTrash) {
              const childHandler = this.getHandler(child.resource_type);
              await childHandler.permanentDelete(
                context,
                child,
                { user: param.user, req: param.req },
                ncMeta,
              );
              await BaseTrash.delete(context, child.id, ncMeta);
            }
            if (childTrash.length < CHILD_CLEANUP_BATCH) break;
          }
        }
      }

      const lifecycle = await handler.permanentDelete(
        context,
        trashEntry,
        { user: param.user, req: param.req },
        ncMeta,
      );
      // See `restore` — handlers may keep the entry alive when their
      // permanent-delete only swept a subset of the underlying state.
      const keepEntry =
        ncHasProperties<TrashLifecycleResult>(lifecycle, 'keepEntry') &&
        !!lifecycle.keepEntry;
      if (!keepEntry) {
        await BaseTrash.delete(context, trashEntry.id, ncMeta);
      }
      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e.message, e.stack);
      NcError.get(context).internalServerError('Failed to permanently delete');
    }

    handler.invalidateCaches(
      context.workspace_id,
      trashEntry.base_id ?? context.base_id,
    );

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
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const batchSize = 100;
    let batch: BaseTrash[];
    let deleted = 0;
    const failed: Array<{ id: string; error: string }> = [];

    do {
      ({ list: batch } = await BaseTrash.list(context, {
        base_id: param.baseId,
        limit: batchSize,
      }));

      let batchDeleted = 0;
      for (const entry of batch) {
        try {
          await this.permanentDelete(context, {
            trashId: entry.id,
            user: param.user,
            req: param.req,
          });
          deleted++;
          batchDeleted++;
        } catch (e) {
          this.logger.error(
            `Failed to permanently delete trash entry ${entry.id}: ${e.message}`,
            e.stack,
          );
          failed.push({ id: entry.id, error: e?.message ?? 'unknown' });
        }
      }

      if (batch.length && batchDeleted === 0) break;
    } while (batch.length === batchSize);

    return { deleted, failed };
  }
}
