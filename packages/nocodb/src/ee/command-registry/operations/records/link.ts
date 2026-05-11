import { pickLinkParams, resolveModelIdFromParams } from './_shared';
import type { RecordLinkExtra } from './_shared';
import type { OperationContract } from '~/command-registry/types';
import type { DataTableService } from '~/services/data-table.service';
import type { DataAliasNestedService } from '~/services/data-alias-nested.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { MetaTable } from '~/utils/globals';
import { Model } from '~/models';
import { recordLinkSchema } from '~/command-registry/operations/_schemas/record';
import { recordActions } from '~/decorators/trace-command-descriptions';

export const RecordLinkAddContract: OperationContract<
  typeof recordLinkSchema,
  RecordLinkExtra,
  unknown
> = {
  name: OperationName.recordLinkAdd,
  entity: MetaTable.MODELS,
  schema: recordLinkSchema,
  sandbox: false,
  entry: {
    description: recordActions.linkAdd,
    before: async (context, params) => {
      const modelId = await resolveModelIdFromParams(context, params);
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      return {
        parentEntityTitle: model.title,
        extra: { modelId, parentEntityTitle: model.title ?? '' },
      };
    },
    entity_id: (params) => String(params.rowId),
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId ?? params.modelId;
      if (!modelId && !params.tableName) return null;
      const picked = pickLinkParams(params);
      if (modelId && !picked.modelId) picked.modelId = modelId;
      return {
        name: OperationName.recordLinkRemove,
        params: picked,
      };
    },
  },
};

export const RecordLinkRemoveContract: OperationContract<
  typeof recordLinkSchema,
  RecordLinkExtra,
  unknown
> = {
  name: OperationName.recordLinkRemove,
  entity: MetaTable.MODELS,
  schema: recordLinkSchema,
  sandbox: false,
  entry: {
    description: recordActions.linkRemove,
    before: async (context, params) => {
      const modelId = await resolveModelIdFromParams(context, params);
      if (!modelId) return {};
      const model = await Model.get(context, modelId);
      if (!model) return {};
      return {
        parentEntityTitle: model.title,
        extra: { modelId, parentEntityTitle: model.title ?? '' },
      };
    },
    entity_id: (params) => String(params.rowId),
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const modelId = resolved?.extra?.modelId ?? params.modelId;
      if (!modelId && !params.tableName) return null;
      const picked = pickLinkParams(params);
      if (modelId && !picked.modelId) picked.modelId = modelId;
      return {
        name: OperationName.recordLinkAdd,
        params: picked,
      };
    },
  },
};

export function registerLinkHandlers(
  dataTableSvc: DataTableService,
  dataAliasNestedSvc: DataAliasNestedService,
): void {
  // Both link contracts dispatch to v1 (`relationData*` → `addChild` /
  // `removeChild`) when v1 params are present, else v2 (`nestedLink` /
  // `nestedUnlink` → `addLinks` / `removeLinks`). Routing on shape keeps
  // the inverse on the same audit/realtime path the forward op used.
  const isV1LinkParams = (p: any): boolean =>
    !!(p.tableName && p.columnName && p.refRowId !== undefined);

  OperationRegistry.register(
    RecordLinkAddContract,
    async (context, params, meta) => {
      if (isV1LinkParams(params)) {
        return await dataAliasNestedSvc.relationDataAdd(context, {
          baseName: params.baseName as string,
          tableName: params.tableName as string,
          viewName: params.viewName as string,
          columnName: params.columnName as string,
          rowId: String(params.rowId),
          refRowId: String(params.refRowId),
          cookie: meta.originalReq,
        } as any);
      }
      return await dataTableSvc.nestedLink(context, {
        modelId: params.modelId as string,
        viewId: params.viewId as string,
        columnId: params.columnId as string,
        rowId: String(params.rowId),
        refRowIds: params.refRowIds as any,
        cookie: meta.originalReq,
        query: params.query,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
      } as any);
    },
  );

  OperationRegistry.register(
    RecordLinkRemoveContract,
    async (context, params, meta) => {
      if (isV1LinkParams(params)) {
        return await dataAliasNestedSvc.relationDataRemove(context, {
          baseName: params.baseName as string,
          tableName: params.tableName as string,
          viewName: params.viewName as string,
          columnName: params.columnName as string,
          rowId: String(params.rowId),
          refRowId: String(params.refRowId),
          cookie: meta.originalReq,
        } as any);
      }
      return await dataTableSvc.nestedUnlink(context, {
        modelId: params.modelId as string,
        viewId: params.viewId as string,
        columnId: params.columnId as string,
        rowId: String(params.rowId),
        refRowIds: params.refRowIds as any,
        cookie: meta.originalReq,
        query: params.query,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
      } as any);
    },
  );
}
