import {
  buildRowFromCompositePk,
  getBaseModelForModel,
  pkFromRow,
  reapplyDisplacedForward,
  recordInsertSchema,
  resolveModelForEntry,
  resolveReplayModel,
  restoreDisplaced,
  stripServerControlledFields,
} from './_shared';
import type { RecordInsertExtra } from './_shared';
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
  recordInsertCaptureSchema,
  recordInsertUndoSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

export const RecordInsertContract: OperationContract<
  typeof recordInsertSchema,
  RecordInsertExtra,
  Record<string, any> | undefined
> = {
  name: OperationName.recordInsert,
  entity: MetaTable.MODELS,
  schema: recordInsertSchema,
  sandbox: false,
  capture: ['displacedRecords', 'recordModelContext'],
  capture_schema: recordInsertCaptureSchema,
  entry: {
    description: recordActions.insert,
    before: async (context, params) => {
      const resolved = await resolveModelForEntry(context, params);
      if (!resolved) return {};
      return { parentEntityTitle: resolved.model.title, extra: resolved.ctx };
    },
    entity_id: (_params, result, resolved) => {
      if (!result || Array.isArray(result)) return undefined;
      return pkFromRow(result as Record<string, any>, resolved?.extra);
    },
    skip_if: (_ctx, params) => Array.isArray(params.body),
  },
  undo: {
    inverse: (_ctx, _params, result, resolved) => {
      if (!result || Array.isArray(result)) return null;
      const modelId = resolved?.extra?.modelId;
      if (!modelId) return null;
      const pk = pkFromRow(result as Record<string, any>, resolved?.extra);
      if (pk == null) return null;
      const displaced = getTraceCapture('displacedRecords') ?? [];
      return {
        name: OperationName.recordInsertUndo,
        params: {
          modelId,
          pk,
          displacedRecords: [...displaced],
        },
      };
    },
  },
};

/** Inverse-only primitive that reverses a `recordInsert`:
 *   1. Soft/hard-deletes the inserted row by pk.
 *   2. Restores each captured `DisplacedRecord`. */
export const RecordInsertUndoContract: OperationContract<
  typeof recordInsertUndoSchema
> = {
  name: OperationName.recordInsertUndo,
  entity: MetaTable.MODELS,
  schema: recordInsertUndoSchema,
  sandbox: false,
  undo: false,
  entry: {
    entity_id: 'pk',
    description: recordActions.insertUndo,
  },
};

export function registerInsertHandlers(
  dataTableSvc: DataTableService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    RecordInsertContract,
    async (context, params, meta) => {
      const trashId = meta.extra?.softDeleteTrashId;
      if (trashId) {
        await reapplyDisplacedForward(
          context,
          meta.extra?.displacedRecords ?? [],
          meta.originalReq,
        );
        await baseTrashSvc.restore(context, {
          trashId,
          user: meta.originalReq?.user ?? { id: meta.createdBy },
          req: meta.originalReq,
          force: true,
        });
        return { metaUpdate: { softDeleteTrashId: null } };
      }

      const { modelId, model, persistedCtx } = await resolveReplayModel(
        context,
        params,
        meta,
        'recordInsert',
      );

      // Force the original pk(s) so refs to the recorded id keep working.
      let body = params.body as Record<string, any> | unknown[] | undefined;
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        body = stripServerControlledFields(
          body as Record<string, any>,
          model.columns,
        );
        if (meta.entityId && persistedCtx?.primaryKeyTitles?.length) {
          const row = buildRowFromCompositePk(meta.entityId, model);
          for (const [k, v] of Object.entries(row)) {
            if ((body as Record<string, any>)[k] == null) {
              (body as Record<string, any>)[k] = v;
            }
          }
        }
      }

      return await dataTableSvc.dataInsert(context, {
        modelId,
        body,
        viewId: params.viewId as string | undefined,
        baseId: params.baseId as string | undefined,
        cookie: meta.originalReq,
        apiVersion: params.apiVersion as any,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
        undo: true,
        internalFlags: { allowSystemColumn: true },
      } as any);
    },
  );

  // `recordInsertUndo` — soft-delete the row + restore displaced.
  OperationRegistry.register(
    RecordInsertUndoContract,
    async (context, params, meta) => {
      const model = await Model.get(context, params.modelId);
      if (!model) return;
      await model.getColumns(context);
      if (!model.primaryKey) return;

      const baseModel = await getBaseModelForModel(context, model);

      const { bag } = await runInChildTraceScope(async () => {
        await baseModel.delByPk(params.pk, null, meta.originalReq);
      });
      const trashId = bag.get('softDeleteTrashId') as string | undefined;

      await restoreDisplaced(
        context,
        params.displacedRecords as ReadonlyArray<DisplacedRecord>,
        meta.originalReq,
      );

      return trashId
        ? { metaUpdate: { softDeleteTrashId: trashId } }
        : undefined;
    },
  );
}
