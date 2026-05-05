import { z } from 'zod';
import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from 'src/command-registry/types';
import type { LtarSideEffectIds } from '~/services/columns.service.type';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Column, Filter, Model } from '~/models';
import { fieldActions } from '~/decorators/trace-command-descriptions';
import { extractFormulaColumnRefs } from '~/ee/helpers/formulaDeps';

// ─── columnAdd ───────────────────────────────────────────────────────────────

const columnAddSchema = z.object({
  tableId: z.string(),
  column: z.record(z.unknown()),
});

// LTAR side-effect IDs captured by `createLTARColumn` into `param._ltarCapture`
// during recording. Threaded onto the changelog row via `extraCommandMeta` and
// read by the columnAdd handler (`columns.handlers.ts`) at replay time so the
// junction model, FK columns, back-link columns, and reverse LTAR all keep
// stable IDs across the merge boundary.
const ltarHmBtCallSchema = z
  .object({
    childRelColId: z.string().optional(),
    savedColumnId: z.string().optional(),
  })
  .optional();

const columnAddExtraSchema = z
  .object({
    ltar: z
      .object({
        fkColumnId: z.string().optional(),
        assocModelId: z.string().optional(),
        assocDefaultViewId: z.string().optional(),
        reverseColumnId: z.string().optional(),
        assocChildColId: z.string().optional(),
        assocParentColId: z.string().optional(),
        hmBtCallRef: ltarHmBtCallSchema,
        hmBtCallTable: ltarHmBtCallSchema,
      })
      .optional(),
    filters: z.array(z.record(z.unknown())).optional(),
  })
  .optional();

export const ColumnAddContract: OperationContract<typeof columnAddSchema> = {
  name: OperationName.columnAdd,
  version: 1,
  entity: MetaTable.COLUMNS,
  schema: columnAddSchema,
  extraSchema: columnAddExtraSchema,
  idField: 'column',
  entityId: (_p, r) => {
    // V3 path: result is Column (has fk_model_id)
    if ((r as any)?.fk_model_id !== undefined) return (r as any).id;
    // V1 path: result is Model; find the added column by title
    const title =
      (_p?.column as any)?.title ?? (_p?.column as any)?.column_name;
    return (r as any)?.columns?.find((c: any) => c.title === title)?.id;
  },
  entityTitle: (p) => (p?.column as any)?.title,
  parentId: 'tableId',
  description: fieldActions.add,
  resolveCtx: async (context, param) => {
    const table = await Model.get(context, param?.tableId);
    return { parentEntityTitle: table?.title };
  },
  deps: (_p, r) => {
    if (!r || (r as any).uidt !== UITypes.Formula) return [];
    const parsed = (r as any).parsed_tree ?? (r as any).colOptions?.parsed_tree;
    return extractFormulaColumnRefs(parsed).map((id) => ({
      entity: MetaTable.COLUMNS,
      id,
    }));
  },
  extraCommandMeta: (p) => {
    const capture = (p as { _ltarCapture?: LtarSideEffectIds })._ltarCapture;
    const filters = (p as { _capturedFilters?: Array<Record<string, unknown>> })
      ._capturedFilters;
    const meta: Record<string, unknown> = {};
    if (capture && Object.keys(capture).length > 0) meta.ltar = capture;
    if (filters?.length) meta.filters = filters;
    return Object.keys(meta).length > 0 ? meta : undefined;
  },
  buildInverse: (_ctx, p, r) => {
    let newId: string | undefined;
    if ((r as any)?.fk_model_id !== undefined) {
      newId = (r as any).id;
    } else {
      const title =
        (p?.column as any)?.title ?? (p?.column as any)?.column_name;
      newId = (r as any)?.columns?.find((c: any) => c.title === title)?.id;
    }
    if (!newId) return null;
    return {
      name: OperationName.columnDelete,
      version: 1,
      params: { columnId: newId },
    };
  },
};

// ─── columnUpdate ─────────────────────────────────────────────────────────────

const columnUpdateSchema = z.object({
  columnId: z.string(),
  column: z.record(z.unknown()),
  tableId: z.string().optional(),
});

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
};

// Snapshot fields captured before a forward `columnUpdate` so the inverse
// can replay the previous shape on undo. Three layers of fields:
//
//   1. Identity / labels:    `title`, `column_name`, `description`
//   2. UI + DB type:          `uidt`, `dt`, `dtxp`, `dtxs`, `np`, `ns`,
//                             `clen`, `ct`
//      → required for type-change undo. Service reads these to
//        rebuild the original ALTER; cell data is restored separately
//        from the backup column captured by `ColumnDataBackupHandler`.
//   3. Constraints + flags:  `cdf`, `rqd`, `unique`, `un`, `ai`, `pk`,
//                             `pv`, `validate`
//   4. Virtual config:        `colOptions` (Lookup/Rollup/QR/Barcode/
//                             Formula/Button — entire colOptions blob),
//                             `meta` (UI metadata)
//
// Edge case: NOT-NULL-add / unique-add can fail on data that drifted
// between forward and undo — same failure mode as the original forward
// call, surfaced to the user via the dispatch error path.
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
] as const;

interface ColumnUpdateExtra {
  oldTitle?: string;
  oldUidt?: string;
  prev?: Record<string, unknown>;
  prevFilters?: Array<Record<string, unknown>>;
}

const columnBackupRefSchema = z.object({
  tableName: z.string(),
  backupColumnName: z.string(),
  sourceColumnId: z.string(),
  fkModelId: z.string(),
});

const columnUpdateExtraSchema = z
  .object({
    backup: columnBackupRefSchema.optional(),
  })
  .optional();

function snapshotColumnFields(
  col: Column | null | undefined,
): Record<string, unknown> | undefined {
  if (!col) return undefined;
  const src = col as unknown as Record<string, unknown>;
  const snap: Record<string, unknown> = {};
  for (const k of COLUMN_PREV_FIELDS) snap[k] = src[k];
  return snap;
}

async function snapshotColumnFilterTree(
  context: NcContext,
  col: Column,
): Promise<Array<Record<string, unknown>> | undefined> {
  const uidt = (col as unknown as { uidt?: string }).uidt;
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
  const walk = async (f: Filter): Promise<Record<string, unknown>> => {
    const children = f.is_group ? (await f.getChildren(context)) ?? [] : [];
    const childNodes = await Promise.all(
      children.map((c) => walk(c as Filter)),
    );
    return {
      ...(f as unknown as Record<string, unknown>),
      ...(childNodes.length ? { children: childNodes } : {}),
    };
  };
  return Promise.all(roots.map((r) => walk(r as Filter)));
}

export const ColumnUpdateContract: OperationContract<
  typeof columnUpdateSchema,
  ColumnUpdateExtra
> = {
  name: OperationName.columnUpdate,
  version: 1,
  entity: MetaTable.COLUMNS,
  schema: columnUpdateSchema,
  extraSchema: columnUpdateExtraSchema,
  entityId: (p) => p?.columnId,
  entityTitle: (p) => (p?.column as any)?.title,
  parentId: (p) => (p?.column as any)?.fk_model_id ?? p?.tableId,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? fieldActions.rename(ctx)
      : fieldActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const col = await Column.get(context, { colId: param?.columnId });
    const tableId = col?.fk_model_id;
    const table = tableId ? await Model.get(context, tableId) : undefined;
    const willReplaceFilters = Array.isArray(
      (param?.column as Record<string, unknown>)?.filters,
    );
    const prevFilters =
      willReplaceFilters && col
        ? await snapshotColumnFilterTree(context, col)
        : undefined;
    return {
      parentEntityTitle: table?.title,
      extra: {
        oldTitle: col?.title,
        oldUidt: col?.uidt,
        ...(col ? { prev: snapshotColumnFields(col) } : {}),
        ...(prevFilters ? { prevFilters } : {}),
      },
    };
  },
  extraCommandMeta: (p) => {
    const backup = (p as { _columnBackup?: unknown })._columnBackup;
    return backup ? { backup } : undefined;
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    const prevFilters = resolved?.extra?.prevFilters;
    const oldUidt = resolved?.extra?.oldUidt;
    if (!prev && !prevFilters) return null;

    const liftFields = oldUidt ? TOP_LEVEL_LIFT_BY_UIDT[oldUidt] ?? [] : [];
    const colOptions = (prev as { colOptions?: Record<string, unknown> })
      ?.colOptions;
    const liftedTopLevel: Record<string, unknown> = {};
    if (colOptions && typeof colOptions === 'object') {
      for (const k of liftFields) {
        if (colOptions[k] !== undefined) liftedTopLevel[k] = colOptions[k];
      }
    }

    return {
      name: OperationName.columnUpdate,
      version: 1,
      params: {
        columnId: p.columnId,
        column: {
          ...(prev ?? {}),
          ...liftedTopLevel,
          ...(prevFilters
            ? { filters: prevFilters, _replaceFilters: true }
            : {}),
        },
        ...(p.tableId ? { tableId: p.tableId } : {}),
      },
    };
  },
  deps: (_p, r) => {
    if (!r || (r as any).uidt !== UITypes.Formula) return [];
    const parsed = (r as any).parsed_tree ?? (r as any).colOptions?.parsed_tree;
    return extractFormulaColumnRefs(parsed).map((id) => ({
      entity: MetaTable.COLUMNS,
      id,
    }));
  },
};

// ─── columnDelete ─────────────────────────────────────────────────────────────

const columnDeleteSchema = z.object({
  columnId: z.string(),
});

export const ColumnDeleteContract: OperationContract<
  typeof columnDeleteSchema
> = {
  name: OperationName.columnDelete,
  version: 1,
  entity: MetaTable.COLUMNS,
  schema: columnDeleteSchema,
  entityId: (p) => p?.columnId,
  description: fieldActions.delete,
  resolveCtx: async (context, param) => {
    const col = await Column.get(context, { colId: param?.columnId });
    if (!col) return {};
    const table = col.fk_model_id
      ? await Model.get(context, col.fk_model_id)
      : undefined;
    return {
      entityTitle: col.title,
      parentEntityTitle: table?.title,
    };
  },
  buildInverse: (_ctx, p) => ({
    name: OperationName.trashRestore,
    version: 1,
    params: { resourceType: 'field', resourceId: p.columnId },
  }),
};

// ─── columnSetAsPrimary ───────────────────────────────────────────────────────

const columnSetAsPrimarySchema = z.object({
  columnId: z.string(),
});

interface ColumnSetAsPrimaryExtra {
  prevPrimaryColumnId?: string;
}

export const ColumnSetAsPrimaryContract: OperationContract<
  typeof columnSetAsPrimarySchema,
  ColumnSetAsPrimaryExtra
> = {
  name: OperationName.columnSetAsPrimary,
  version: 1,
  entity: MetaTable.COLUMNS,
  schema: columnSetAsPrimarySchema,
  entityId: (p) => p?.columnId,
  description: fieldActions.setAsPrimary,
  resolveCtx: async (context, param) => {
    const col = await Column.get(context, { colId: param?.columnId });
    if (!col) return {};
    const table = col.fk_model_id
      ? await Model.get(context, col.fk_model_id)
      : undefined;
    // Capture the table's current primary column BEFORE the toggle so undo
    // can flip it back. `pv` is unique per table, so this is a single id.
    let prevPrimaryColumnId: string | undefined;
    if (table) {
      const cols = await table.getColumns(context);
      prevPrimaryColumnId = cols.find((c) => c.pv)?.id;
    }
    return {
      entityTitle: col.title,
      parentEntityTitle: table?.title,
      extra: { prevPrimaryColumnId },
    };
  },
  buildInverse: (_ctx, _p, _r, resolved) => {
    const prev = resolved?.extra?.prevPrimaryColumnId;
    if (!prev) return null;
    return {
      name: OperationName.columnSetAsPrimary,
      version: 1,
      params: { columnId: prev },
    };
  },
};
