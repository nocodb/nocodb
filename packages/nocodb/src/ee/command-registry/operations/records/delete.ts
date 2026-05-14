import {
  buildRedoMetaUpdate,
  buildRowFromCompositePk,
  entityIdFromRowOrBody,
  extractRowPk,
  extractRowPkFromParams,
  getBaseModelForModel,
  logger,
  ltarKeysFromColumns,
  pickFreshestList,
  pickFreshestPrev,
  resolveModelForEntry,
  resolveReplayModel,
  restoreDisplaced,
  scopeRecordOp,
  stripServerControlledFields,
} from './_shared';
import type { RecordDeleteExtra, ReplaySkip } from './_shared';
import type {
  DisplacedRecord,
  OperationContract,
} from '~/command-registry/types';
import type { DataTableService } from '~/services/data-table.service';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { MetaTable } from '~/utils/globals';
import { Model } from '~/models';
import {
  getTraceCapture,
  runInChildTraceScope,
} from '~/decorators/trace-command.decorator';
import {
  recordDeleteCaptureSchema,
  recordDeleteSchema,
  recordDeleteUndoSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

export const RecordDeleteContract: OperationContract<
  typeof recordDeleteSchema,
  RecordDeleteExtra,
  unknown
> = {
  name: OperationName.recordDelete,
  entity: MetaTable.MODELS,
  schema: recordDeleteSchema,
  sandbox: false,
  capture: [
    'recordModelContext',
    'recordPrev',
    'displacedRecords',
    'softDeleteTrashId',
  ],
  capture_schema: recordDeleteCaptureSchema,
  entry: {
    description: recordActions.delete,
    before: async (context, params) => {
      const resolved = await resolveModelForEntry(context, params, {
        fallbackToParamsModelId: true,
      });
      if (!resolved) return {};
      return {
        parentEntityTitle: resolved.model.title,
        extra: {
          ...resolved.ctx,
          parentEntityTitle: resolved.model.title ?? '',
        },
      };
    },
    entity_id: entityIdFromRowOrBody,
    skip_if: (_ctx, params) =>
      Array.isArray(params.body) && (params.body as any[]).length > 1,
  },
  undo: {
    inverse: async (context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const model = await Model.get(context, modelId);
      if (!model) return null;
      await model.getColumns(context);
      const pk = extractRowPkFromParams(params, model);
      if (!pk) return null;
      const prevList = getTraceCapture('recordPrev') ?? [];
      const prev =
        prevList.find((r) => extractRowPk(r, model) === pk) ?? prevList[0];
      if (!prev) return null;
      const displaced = getTraceCapture('displacedRecords') ?? [];
      return {
        name: OperationName.recordDeleteUndo,
        params: {
          modelId,
          pk,
          prev,
          ...(displaced.length ? { displacedRecords: [...displaced] } : {}),
        },
      };
    },
    scope: scopeRecordOp,
  },
};

export const RecordDeleteUndoContract: OperationContract<
  typeof recordDeleteUndoSchema
> = {
  name: OperationName.recordDeleteUndo,
  entity: MetaTable.MODELS,
  schema: recordDeleteUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    entity_id: (params) => String(params.pk),
    description: recordActions.deleteUndo,
  },
};

export function registerDeleteHandlers(
  dataTableSvc: DataTableService,
  baseTrashSvc: BaseTrashService,
): void {
  // `recordDelete` redo. Routes through bulkDelete([row]) to match the
  // forward audit shape. Child trace scope harvests fresh recordPrev /
  // displacedRecords / softDeleteTrashId so the next undo replays
  // against the post-redo world.
  OperationRegistry.register(
    RecordDeleteContract,
    async (context, params, meta) => {
      const { model } = await resolveReplayModel(
        context,
        params,
        meta,
        'recordDelete',
      );
      const pk = extractRowPkFromParams(params, model);
      if (!pk) {
        throw new Error(`recordDelete replay: could not resolve pk`);
      }
      const baseModel = await getBaseModelForModel(context, model);
      const deleteRow = buildRowFromCompositePk(pk, model);
      const { bag } = await runInChildTraceScope(async () => {
        try {
          await baseModel.bulkDelete([deleteRow], {
            cookie: meta.originalReq,
            isSingleRecordDeletion: true,
          });
        } catch {
          try {
            await baseModel.delByPk(pk, null, meta.originalReq);
          } catch {}
        }
      });
      const metaUpdate = {
        softDeleteTrashId:
          (bag.get('softDeleteTrashId') as string | undefined) ?? null,
        ...(buildRedoMetaUpdate(bag, ['recordPrev', 'displacedRecords']) ?? {}),
      };
      return { metaUpdate };
    },
  );

  // `recordDeleteUndo`. Trash path → restore by trashId. No-trash path →
  // re-insert prev row + restore displaced links.
  //
  // Prefers `meta.extra` over frozen `params` for prev / displacedRecords:
  // redo rotates these via metaUpdate so the second undo replays against
  // the post-redo world.
  OperationRegistry.register(
    RecordDeleteUndoContract,
    async (context, params, meta) => {
      const trashId = meta.extra?.softDeleteTrashId;
      if (trashId) {
        try {
          await baseTrashSvc.restore(context, {
            trashId,
            user: meta.originalReq?.user ?? { id: meta.createdBy },
            req: meta.originalReq,
            force: true,
          });
          return { metaUpdate: { softDeleteTrashId: null } };
        } catch (e: any) {
          // Trash entry was purged — fall through to the no-trash
          // re-insert + restore-displaced path so undo still completes.
          logger.warn(
            `recordDeleteUndo: trash restore failed (${e?.message}); ` +
              `falling back to re-insert from prev`,
          );
        }
      }

      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);
      const prevForUndo = pickFreshestPrev(meta, params, model);
      // Linked state is restored separately via displacedRecords —
      // strip nested LTAR snapshots from the re-insert body.
      const stripped = stripServerControlledFields(prevForUndo, model.columns);
      const ltarKeys = ltarKeysFromColumns(model.columns);
      const body: Record<string, any> = {};
      for (const [k, v] of Object.entries(stripped)) {
        if (ltarKeys.has(k)) continue;
        body[k] = v;
      }
      await dataTableSvc.dataInsert(context, {
        modelId: params.modelId,
        body,
        cookie: meta.originalReq,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
        undo: true,
        internalFlags: { allowSystemColumn: true },
      } as any);

      const skipped: ReplaySkip[] = [
        ...(await restoreDisplaced(
          context,
          pickFreshestList<DisplacedRecord>(meta, params, 'displacedRecords'),
          meta.originalReq,
        )),
      ];

      return skipped.length ? { skipped } : undefined;
    },
  );
}
