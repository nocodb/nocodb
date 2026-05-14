import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { ColumnReqType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import type { ColumnsService } from '~/services/columns.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { ColumnDataBackupHandler } from '~/services/column-data-backup-handler.service';
import Noco from '~/Noco';
import BaseTrash from '~/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
  registerMacro,
} from '~/command-registry/replay-context';
import { scopeTable } from '~/command-registry/scope';
import { getReplay, isReplay, setReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Column, Filter, Model } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import { fieldActions } from '~/decorators/trace-command-descriptions';
import { extractFormulaColumnRefs } from '~/ee/helpers/formulaDeps';
import {
  columnAddExtraSchema,
  columnAddSchema,
  columnDeleteSchema,
  columnsBulkSchema,
  columnSetAsPrimarySchema,
  columnUpdateExtraSchema,
  columnUpdateSchema,
} from '~/command-registry/operations/_schemas/column';
import { pickFilterTreeFields } from '~/command-registry/operations/shared/filter-snapshot';

// V1 returns parent Model (column appended to `columns[]`); V3 returns the
// Column row directly. Discriminate by `fk_model_id` to extract the new id.
type ColumnAddResult =
  | (Column & { fk_model_id: string })
  | { columns?: Array<{ id?: string; title?: string }> };

function resolveAddedColumnId(
  result: ColumnAddResult | undefined,
  title: string | undefined,
): string | undefined {
  if (!result) return undefined;
  if ('fk_model_id' in result && result.fk_model_id !== undefined) {
    return result.id;
  }
  if ('columns' in result && Array.isArray(result.columns) && title) {
    return result.columns.find((c) => c.title === title)?.id;
  }
  return undefined;
}

/**
 * Used by `ColumnAdd.dependencies` (R = ColumnAddResult — V1 model wrap or
 * V3 column row) and `ColumnUpdate.dependencies` (R = Column). Only Formula
 * columns have deps to extract — bail when the shape doesn't match.
 */
function deriveColumnDeps(result: unknown) {
  const col = result as
    | {
        uidt?: string;
        parsed_tree?: unknown;
        colOptions?: { parsed_tree?: unknown };
      }
    | undefined;
  if (!col || col.uidt !== UITypes.Formula) return [];
  const parsed = col.parsed_tree ?? col.colOptions?.parsed_tree;
  return extractFormulaColumnRefs(parsed).map((id) => ({
    entity: MetaTable.COLUMNS,
    id,
  }));
}

export const ColumnAddContract: OperationContract<
  typeof columnAddSchema,
  Record<string, any>,
  ColumnAddResult | undefined
> = {
  name: OperationName.columnAdd,
  entity: MetaTable.COLUMNS,
  schema: columnAddSchema,
  entry: {
    entity_id: (_params, result) => {
      const title =
        _params?.column?.title ?? _params?.column?.column_name ?? undefined;
      return resolveAddedColumnId(result, title);
    },
    entity_title: (params) => params?.column?.title,
    parent_id: 'tableId',
    description: fieldActions.add,
    before: async (context, params) => {
      const table = await Model.get(context, params?.tableId);
      return { parentEntityTitle: table?.title };
    },
  },
  capture: ['ltar', 'filters'],
  capture_schema: columnAddExtraSchema,
  sandbox: {
    id_field: 'column',
    dependencies: (_params, result) => deriveColumnDeps(result),
  },
  undo: {
    inverse: (_context, params, result) => {
      const title =
        params?.column?.title ?? params?.column?.column_name ?? undefined;
      const newId = resolveAddedColumnId(result, title);
      if (!newId) return null;
      return {
        name: OperationName.columnDelete,
        params: { columnId: newId },
      };
    },
    scope: (params) => scopeTable(params.tableId),
  },
};

const TOP_LEVEL_LIFT_BY_UIDT: Record<string, readonly string[]> = {
  [UITypes.Lookup]: ['fk_relation_column_id', 'fk_lookup_column_id'],
  [UITypes.Rollup]: [
    'fk_relation_column_id',
    'fk_rollup_column_id',
    'rollup_function',
  ],
  [UITypes.QrCode]: ['fk_qr_value_column_id'],
  [UITypes.Barcode]: ['fk_barcode_value_column_id', 'barcode_format'],
  [UITypes.Formula]: ['formula', 'formula_raw', 'parsed_tree'],
  [UITypes.Button]: [
    'type',
    'formula',
    'formula_raw',
    'webhook_id',
    'theme',
    'color',
    'icon',
    'label',
    'color_meta',
  ],
  [UITypes.LinkToAnotherRecord]: ['fk_display_value_column_id'],
  [UITypes.Links]: ['fk_display_value_column_id'],
};

// Cell data is restored separately via `ColumnDataBackupHandler` (the
// `backup` capture key); these fields rebuild the schema-level ALTER.
const COLUMN_PREV_FIELDS = [
  'title',
  'column_name',
  'description',
  'uidt',
  'dt',
  'dtxp',
  'dtxs',
  'np',
  'ns',
  'clen',
  'ct',
  'cdf',
  'rqd',
  'unique',
  'un',
  'ai',
  'pk',
  'pv',
  'validate',
  'meta',
  'colOptions',
] as const satisfies readonly (keyof Column)[];

type ColumnSnapshot = Pick<Column, (typeof COLUMN_PREV_FIELDS)[number]>;

interface FilterTreeNode extends Record<string, unknown> {
  children?: FilterTreeNode[];
}

interface ColumnUpdateExtra {
  fkModelId?: string;
  oldTitle?: string;
  oldUidt?: string;
  prev?: ColumnSnapshot;
  prevFilters?: FilterTreeNode[];
}

function snapshotColumnFields(
  col: Column | null | undefined,
): ColumnSnapshot | undefined {
  if (!col) return undefined;
  return pickFields(col, COLUMN_PREV_FIELDS);
}

async function snapshotColumnFilterTree(
  context: NcContext,
  col: Column,
): Promise<FilterTreeNode[] | undefined> {
  const uidt = col.uidt;
  if (!uidt) return undefined;
  const isLinkLike =
    isLinksOrLTAR({ uidt }) ||
    uidt === UITypes.Lookup ||
    uidt === UITypes.Rollup;
  const isButton = uidt === UITypes.Button;
  if (!isLinkLike && !isButton) return undefined;
  const roots = isButton
    ? await Filter.rootFilterListByButtonColumn(context, {
        buttonColId: col.id,
      })
    : await Filter.rootFilterListByLink(context, { columnId: col.id });
  const walk = async (f: Filter): Promise<FilterTreeNode> => {
    const children = f.is_group ? (await f.getChildren(context)) ?? [] : [];
    const childNodes = await Promise.all(
      children.map((c) => walk(c as Filter)),
    );
    return pickFilterTreeFields(f, childNodes) as FilterTreeNode;
  };
  return Promise.all(roots.map((result) => walk(result as Filter)));
}

export const ColumnUpdateContract: OperationContract<
  typeof columnUpdateSchema,
  ColumnUpdateExtra,
  Column | undefined
> = {
  name: OperationName.columnUpdate,
  entity: MetaTable.COLUMNS,
  schema: columnUpdateSchema,
  entry: {
    entity_id: (params) => params.columnId,
    entity_title: (params) => params.column?.title,
    parent_id: (params) =>
      // `column` body is `.passthrough()` so fields not explicitly declared
      // in the schema land as `unknown` — `fk_model_id` is one of them.
      (params.column?.fk_model_id as string | undefined) ?? params.tableId,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? fieldActions.rename(context)
        : fieldActions.edit(context),
    before: async (context, params) => {
      const col = await Column.get(context, { colId: params?.columnId });
      const tableId = col?.fk_model_id;
      const table = tableId ? await Model.get(context, tableId) : undefined;
      const willReplaceFilters = Array.isArray(params?.column?.filters);
      const prevFilters =
        willReplaceFilters && col
          ? await snapshotColumnFilterTree(context, col)
          : undefined;
      return {
        parentEntityTitle: table?.title,
        extra: {
          fkModelId: tableId,
          oldTitle: col?.title,
          oldUidt: col?.uidt,
          ...(col ? { prev: snapshotColumnFields(col) } : {}),
          ...(prevFilters ? { prevFilters } : {}),
        },
      };
    },
  },
  capture: ['backup'],
  capture_schema: columnUpdateExtraSchema,
  on_record_failure: async (context, capture) => {
    if (!capture.backup) return;
    const handler: ColumnDataBackupHandler = Noco.nestApp.get(
      ColumnDataBackupHandler,
    );
    await handler.drop(context, { backupRef: capture.backup });
  },
  sandbox: {
    dependencies: (_params, result) => deriveColumnDeps(result),
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      const prevFilters = resolved?.extra?.prevFilters;
      const oldUidt = resolved?.extra?.oldUidt;
      if (!prev && !prevFilters) return null;

      const liftFields = oldUidt ? TOP_LEVEL_LIFT_BY_UIDT[oldUidt] ?? [] : [];
      const colOptions = prev?.colOptions as
        | Record<string, unknown>
        | undefined;
      const liftedTopLevel: Record<string, unknown> = {};
      if (colOptions && typeof colOptions === 'object') {
        for (const k of liftFields) {
          if (colOptions[k] !== undefined) liftedTopLevel[k] = colOptions[k];
        }
      }

      return {
        name: OperationName.columnUpdate,
        params: {
          columnId: params.columnId,
          column: {
            ...(prev ?? {}),
            ...liftedTopLevel,
            ...(prevFilters
              ? { filters: prevFilters, _replaceFilters: true }
              : {}),
          },
          ...(params.tableId ? { tableId: params.tableId } : {}),
        },
      };
    },
    scope: (params, _r, resolved) =>
      scopeTable(
        (params.tableId as string | undefined) ?? resolved?.extra?.fkModelId,
      ),
  },
};

interface ColumnDeleteExtra {
  /** Owning table — captured before the column row is deleted so `scope`
   *  can route undo to the table stack. */
  fkModelId?: string;
}

export const ColumnDeleteContract: OperationContract<
  typeof columnDeleteSchema,
  ColumnDeleteExtra,
  unknown
> = {
  name: OperationName.columnDelete,
  entity: MetaTable.COLUMNS,
  schema: columnDeleteSchema,
  entry: {
    entity_id: (params) => params?.columnId,
    description: fieldActions.delete,
    before: async (context, params) => {
      const col = await Column.get(context, { colId: params?.columnId });
      if (!col) return {};
      const table = col.fk_model_id
        ? await Model.get(context, col.fk_model_id)
        : undefined;
      return {
        entityTitle: col.title,
        parentEntityTitle: table?.title,
        extra: { fkModelId: col.fk_model_id },
      };
    },
  },
  undo: {
    inverse: (_context, params) => ({
      name: OperationName.trashRestore,
      params: { resourceType: 'field', resourceId: params.columnId },
    }),
    scope: (_p, _r, resolved) => scopeTable(resolved?.extra?.fkModelId),
  },
};

interface ColumnSetAsPrimaryExtra {
  prevPrimaryColumnId?: string;
  /** Owning table — captured by `before` so `scope` doesn't refetch. */
  fkModelId?: string;
}

export const ColumnSetAsPrimaryContract: OperationContract<
  typeof columnSetAsPrimarySchema,
  ColumnSetAsPrimaryExtra,
  unknown
> = {
  name: OperationName.columnSetAsPrimary,
  entity: MetaTable.COLUMNS,
  schema: columnSetAsPrimarySchema,
  entry: {
    entity_id: (params) => params?.columnId,
    description: fieldActions.setAsPrimary,
    before: async (context, params) => {
      const col = await Column.get(context, { colId: params?.columnId });
      if (!col) return {};
      const table = col.fk_model_id
        ? await Model.get(context, col.fk_model_id)
        : undefined;
      // `pv` is unique per table — capture the current pv before toggle.
      let prevPrimaryColumnId: string | undefined;
      if (table) {
        const cols = await table.getColumns(context);
        prevPrimaryColumnId = cols.find((c) => c.pv)?.id;
      }
      return {
        entityTitle: col.title,
        parentEntityTitle: table?.title,
        extra: { prevPrimaryColumnId, fkModelId: col.fk_model_id },
      };
    },
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const prev = resolved?.extra?.prevPrimaryColumnId;
      if (!prev) return null;
      return {
        name: OperationName.columnSetAsPrimary,
        params: { columnId: prev },
      };
    },
    scope: (_p, _r, resolved) => scopeTable(resolved?.extra?.fkModelId),
  },
};

// ── Bulk column operations ────────────────────────────────────────
export const ColumnsBulkContract: OperationContract<
  typeof columnsBulkSchema,
  Record<string, any>,
  unknown
> = {
  name: OperationName.columnsBulk,
  entity: MetaTable.MODELS,
  schema: columnsBulkSchema,
  macro: true,
  entry: {
    entity_id: (params) => params.tableId,
    description: ({ entityTitle, parentEntityTitle }) =>
      `Update fields${entityTitle ? ` of ${entityTitle}` : ''}${
        parentEntityTitle ? ` in ${parentEntityTitle}` : ''
      }`,
    before: async (context, params) => {
      const table = await Model.get(context, params.tableId);
      return { entityTitle: table?.title };
    },
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const transcript = (
        resolved?.extra as
          | { macroTranscript?: ReadonlyArray<unknown> }
          | undefined
      )?.macroTranscript;
      if (!transcript || !transcript.length) return null;
      return {
        name: OperationName.macroUndo,
        params: { transcript },
      };
    },
    scope: (params) => scopeTable(params.tableId),
  },
};

export function registerColumnHandlers(
  svc: ColumnsService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    ColumnAddContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'field',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }

      const ltarIds = meta.extra?.ltar;
      if (ltarIds) setReplay('ltarReplayIds', ltarIds);

      const capturedFilters = meta.extra?.filters;
      const columnPayload = capturedFilters?.length
        ? { ...params.column, filters: capturedFilters }
        : params.column;
      return svc.columnAdd(context, {
        tableId: params.tableId,
        column: columnPayload as unknown as ColumnReqType,
        user: req.user,
        req,
      });
    },
  );

  OperationRegistry.register(
    ColumnUpdateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      const replayBackup = meta.extra?.backup;

      if (isReplay() && replayBackup) {
        setReplay('replayBackup', replayBackup);
      }

      type ColumnUpdateSvcParams = Parameters<typeof svc.columnUpdate>[1] & {
        forceUpdateSystem?: boolean;
      };
      const svcParams: ColumnUpdateSvcParams = {
        ...params,
        ...(isReplay() ? { forceUpdateSystem: true } : {}),
        req,
      } as unknown as ColumnUpdateSvcParams;

      const result = await svc.columnUpdate(context, svcParams);

      if (isReplay()) {
        const newBackup = getReplay('columnBackupOut');
        if (newBackup) {
          return {
            result,
            metaUpdate: { backup: newBackup },
          };
        }
      }
      return result;
    },
  );

  registerForward(ColumnDeleteContract, (context, params) =>
    svc.columnDelete(context, params),
  );
  registerForward(ColumnSetAsPrimaryContract, (context, params) =>
    svc.columnSetAsPrimary(context, params),
  );
  registerMacro(ColumnsBulkContract, (context, params, req) =>
    svc.columnsBulk(context, {
      tableId: params.tableId,
      hash: params.hash,
      ops: params.ops,
      visibility: params.visibility,
      req,
    } as unknown as Parameters<typeof svc.columnsBulk>[1]),
  );
}
