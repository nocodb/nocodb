import { TableV3CreateContract } from '../operations/tables-v3.operations';
import type { TablesV3Service } from '~/services/v3/tables-v3.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import BaseTrash from '~/models/BaseTrash';
import { OperationRegistry } from '~/command-registry/registry';
import { makeReplayReq } from '~/command-registry/replay-context';

interface SandboxColumn {
  id?: string;
  title?: string;
}

export function registerTablesV3Handlers(
  svc: TablesV3Service,
  baseTrashSvc: BaseTrashService,
): void {
  // Mirrors `tables.handlers.ts:registerTableHandlers` (V1/V2 path) so the
  // V3 fan-out (`tableCreate` + N × `columnAdd` for virtual cols) round-trips
  // every child id across undo→redo.
  OperationRegistry.register(
    TableV3CreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);

      // Cheapest path on redo: the inverse trashed the table on undo, so
      // simply restore from trash — Postgres rows for table + every column +
      // every view are still there with their original PKs.
      if (ctx.additionalContext?.is_replay && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          ctx,
          'table',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(ctx, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }

      // Fallback (no trash entry — sandbox replay or trash hard-purged):
      // thread the captured column IDs through `_sandboxColumnIds` so:
      //  - the inner `tablesService.tableCreate` honors them via
      //    `Column.bulkInsert` for non-virtual fields + system columns
      //  - the V3 fan-out's `columnsV3Service.columnAdd` loop sees pre-set
      //    ids on each virtual field (`Column.insert` honors them under
      //    `is_replay`).
      const extra = (meta.extra ?? {}) as {
        sandboxColumns?: SandboxColumn[];
        sandboxDefaultViewId?: string;
      };

      const replayParams = { ...params } as any;
      let colIdMap: Record<string, string> | undefined;
      if (extra.sandboxColumns?.length && replayParams.table) {
        colIdMap = {};
        for (const c of extra.sandboxColumns) {
          if (c.id && c.title) colIdMap[c.title] = c.id;
        }

        // Inject ids onto each field in the V3 body so virtual columns the
        // fan-out loop creates one-by-one keep their original PKs.
        const fields = Array.isArray(replayParams.table.fields)
          ? replayParams.table.fields.map((f: any) => {
              const title = f?.title ?? f?.name;
              const mapped = title ? colIdMap![title] : undefined;
              return mapped && !f.id ? { ...f, id: mapped } : f;
            })
          : replayParams.table.fields;

        replayParams.table = {
          ...replayParams.table,
          ...(fields ? { fields } : {}),
          _sandboxColumnIds: colIdMap,
        };
      }
      if (extra.sandboxDefaultViewId && replayParams.table) {
        replayParams.table = {
          ...replayParams.table,
          _sandboxDefaultViewId: extra.sandboxDefaultViewId,
        };
      }

      const replayCtx = colIdMap
        ? {
            ...ctx,
            additionalContext: {
              ...ctx.additionalContext,
              sandboxColumnIds: colIdMap,
            },
          }
        : ctx;

      return svc.tableCreate(replayCtx, {
        baseId: replayParams.baseId,
        table: replayParams.table,
        sourceId: replayParams.sourceId,
        user: req.user as any,
        req,
      });
    },
  );
}
