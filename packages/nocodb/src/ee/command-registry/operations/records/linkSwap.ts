import { linkSwapBefore, pickLinkSwapParams, scopeRecordOp } from './_shared';
import type { RecordLinkSwapExtra } from './_shared';
import type { OperationContract } from '~/command-registry/types';
import type { DataTableService } from '~/services/data-table.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { MetaTable } from '~/utils/globals';
import {
  recordLinkByDisplaySchema,
  recordLinkSwapBulkSchema,
  recordLinkSwapSchema,
} from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

/** Single-row link-diff op. Self-inverse: the inverse is the same op
 *  with `link` and `unlink` swapped. The handler applies the diff via
 *  `addLinks` / `removeLinks`. */
export const RecordLinkSwapContract: OperationContract<
  typeof recordLinkSwapSchema,
  RecordLinkSwapExtra,
  unknown
> = {
  name: OperationName.recordLinkSwap,
  entity: MetaTable.MODELS,
  schema: recordLinkSwapSchema,
  sandbox: false,
  entry: {
    description: recordActions.linkSwap,
    before: linkSwapBefore,
    entity_id: (params) => String(params.rowId),
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId ?? params.modelId;
      if (!modelId) return null;
      const picked = pickLinkSwapParams(params);
      return {
        name: OperationName.recordLinkSwap,
        params: {
          ...picked,
          link: picked.unlink ?? [],
          unlink: picked.link ?? [],
          modelId,
        },
      };
    },
    scope: scopeRecordOp,
  },
};

/** Bulk variant — multiple link-diffs in one user-facing op.
 *  Self-inverse via per-entry link↔unlink swap. */
export const RecordLinkSwapBulkContract: OperationContract<
  typeof recordLinkSwapBulkSchema,
  RecordLinkSwapExtra,
  unknown
> = {
  name: OperationName.recordLinkSwapBulk,
  entity: MetaTable.MODELS,
  schema: recordLinkSwapBulkSchema,
  sandbox: false,
  entry: {
    description: recordActions.linkSwapBulk,
    before: linkSwapBefore,
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId ?? params.modelId;
      if (!modelId) return null;
      const picked = pickLinkSwapParams(params);
      const swappedEntries = (params.entries ?? []).map((e) => ({
        columnId: e.columnId,
        rowId: e.rowId,
        link: e.unlink ?? [],
        unlink: e.link ?? [],
      }));
      return {
        name: OperationName.recordLinkSwapBulk,
        params: { ...picked, entries: swappedEntries, modelId },
      };
    },
    scope: scopeRecordOp,
  },
};

/** Bulk link-by-display-value — same per-entry shape as bulk swap, but
 *  the forward path resolved display strings to pks before recording.
 *  Replay uses the resolved pks (so data drift between forward and redo
 *  doesn't change which rows get linked). Self-inverse. */
export const RecordLinkByDisplayContract: OperationContract<
  typeof recordLinkByDisplaySchema,
  RecordLinkSwapExtra,
  unknown
> = {
  name: OperationName.recordLinkByDisplay,
  entity: MetaTable.MODELS,
  schema: recordLinkByDisplaySchema,
  sandbox: false,
  entry: {
    description: recordActions.linkByDisplay,
    before: linkSwapBefore,
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId ?? params.modelId;
      if (!modelId) return null;
      const picked = pickLinkSwapParams(params);
      const swappedEntries = (params.entries ?? []).map((e) => ({
        columnId: e.columnId,
        rowId: e.rowId,
        link: e.unlink ?? [],
        unlink: e.link ?? [],
      }));
      return {
        name: OperationName.recordLinkByDisplay,
        params: { ...picked, entries: swappedEntries, modelId },
      };
    },
    scope: scopeRecordOp,
  },
};

export function registerLinkSwapHandlers(dataTableSvc: DataTableService): void {
  OperationRegistry.register(
    RecordLinkSwapContract,
    async (context, params, meta) => {
      return await dataTableSvc._traceApplyLinkSwap(context, {
        modelId: params.modelId,
        baseId: params.baseId,
        viewId: params.viewId,
        columnId: params.columnId,
        rowId: params.rowId,
        link: [...params.link],
        unlink: [...params.unlink],
        cookie: meta.originalReq,
      });
    },
  );

  OperationRegistry.register(
    RecordLinkSwapBulkContract,
    async (context, params, meta) => {
      return await dataTableSvc._traceApplyLinkSwapBulk(context, {
        modelId: params.modelId,
        baseId: params.baseId,
        viewId: params.viewId,
        entries: params.entries.map((e) => ({
          columnId: e.columnId,
          rowId: e.rowId,
          link: [...e.link],
          unlink: [...e.unlink],
        })),
        cookie: meta.originalReq,
      });
    },
  );

  OperationRegistry.register(
    RecordLinkByDisplayContract,
    async (context, params, meta) => {
      return await dataTableSvc._traceApplyLinkByDisplay(context, {
        modelId: params.modelId,
        baseId: params.baseId,
        viewId: params.viewId,
        entries: params.entries.map((e) => ({
          columnId: e.columnId,
          rowId: e.rowId,
          link: [...e.link],
          unlink: [...e.unlink],
        })),
        cookie: meta.originalReq,
      });
    },
  );
}
