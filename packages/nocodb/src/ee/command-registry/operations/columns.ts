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
  columnRevertLinkToTextSchema,
  columnRevertTextToLinkSchema,
  columnsBulkSchema,
  columnSetAsPrimarySchema,
  columnUpdateExtraSchema,
  columnUpdateSchema,
} from '~/command-registry/operations/_schemas/column';
import { pickFilterTreeFields } from '~/command-registry/operations/shared/filter-snapshot';
import { getRelatedLinksColumn } from '~/helpers/dbHelpers';

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
    inverse: (_context, params, result, resolved) => {
      const title =
        params?.column?.title ?? params?.column?.column_name ?? undefined;
      const newId = resolveAddedColumnId(result, title) ?? resolved?.entityId;
      if (!newId) return null;
      return {
        name: OperationName.columnDelete,
        params: { columnId: newId, forceDeleteSystem: true },
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

/** Relationship config of a link column, captured before a link→text
 *  conversion so undo can recreate the link with the same id. */
interface LinkConfigSnapshot {
  id: string;
  fk_model_id: string;
  title?: string;
  uidt?: string;
  type?: string;
  parentId?: string;
  childId?: string;
  ref_base_id?: string | null;
  fk_target_view_id?: string | null;
  fk_display_value_column_id?: string | null;
  meta?: Record<string, unknown> | string | null;
  /**
   * Only for a junction-less `bt` conversion: the converted `bt` column is the
   * *reverse* of an `hm`/`bt` pair, and converting it drops BOTH columns. To
   * faithfully recreate the pair on undo we also need the paired `hm` column's
   * id + title (the `bt` column's own id/title are `id`/`title` above).
   */
  pairedColumnId?: string;
  pairedColumnTitle?: string;
}

interface ColumnUpdateExtra {
  fkModelId?: string;
  oldTitle?: string;
  oldUidt?: string;
  prev?: ColumnSnapshot;
  prevFilters?: FilterTreeNode[];
  /** Set only on a link→SingleLineText conversion. */
  linkConfig?: LinkConfigSnapshot;
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

      // link → SingleLineText conversion deletes the link column outright;
      // capture its relationship config (incl. id) so undo can recreate it.
      let linkConfig: LinkConfigSnapshot | undefined;
      const targetUidt = (params?.column as { uidt?: UITypes })?.uidt;
      if (col && isLinksOrLTAR(col) && targetUidt === UITypes.SingleLineText) {
        const co = await col.getColOptions<any>(context);
        if (co) {
          linkConfig = {
            id: col.id,
            fk_model_id: col.fk_model_id,
            title: col.title,
            uidt: col.uidt,
            type: co.type,
            parentId: col.fk_model_id,
            childId: co.fk_related_model_id,
            ref_base_id: co.fk_related_base_id,
            fk_target_view_id: co.fk_target_view_id,
            fk_display_value_column_id: co.fk_display_value_column_id,
            meta: col.meta as Record<string, unknown> | string | null,
          };

          // A junction-less `bt` is the reverse half of an hm/bt pair, and
          // converting it drops BOTH columns. Capture the paired `hm` column's
          // id + title so undo can recreate the whole pair with original ids
          // (the `bt` column itself is `id`/`title` above). Matched by the
          // shared FK columns via `getRelatedLinksColumn`.
          if (co.type === 'bt' && co.fk_related_model_id) {
            const relatedModel = await Model.get(
              context,
              co.fk_related_model_id,
            );
            if (relatedModel) {
              await relatedModel.getCachedColumns(context);
              const pairedCol = getRelatedLinksColumn(col as any, relatedModel);
              if (pairedCol) {
                linkConfig.pairedColumnId = pairedCol.id;
                linkConfig.pairedColumnTitle = pairedCol.title;
              }
            }
          }
        }
      }

      return {
        parentEntityTitle: table?.title,
        extra: {
          fkModelId: tableId,
          oldTitle: col?.title,
          oldUidt: col?.uidt,
          ...(col ? { prev: snapshotColumnFields(col) } : {}),
          ...(prevFilters ? { prevFilters } : {}),
          ...(linkConfig ? { linkConfig } : {}),
        },
      };
    },
  },
  capture: ['backup', 'ltar', 'convertedLink', 'convertedText'],
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
    inverse: (_context, params, result, resolved) => {
      // SingleLineText→link conversion: the source column is replaced by a new
      // link column, so the generic `prev`-revert can't apply. Invert via
      // `columnRevertLinkToText` (drop the link, recreate the text column with
      // its original id, restore data). The link column id is read from the
      // forward result; its data backup rides on the row's `meta.backup`.
      const convFromUidt = resolved?.extra?.oldUidt;
      const convToUidt = (params.column as { uidt?: UITypes })?.uidt;
      if (
        convFromUidt === UITypes.SingleLineText &&
        isLinksOrLTAR({ uidt: convToUidt })
      ) {
        // Match the new link column by `oldTitle` (the SOURCE column's title
        // captured by `before`), NOT the request body title: the forward
        // conversion renames the link to `originalTitle = column.title`
        // (= `resolved.extra.oldTitle`) and ignores `colBody.title`. A PATCH
        // that renames AND converts in one step (body title ≠ current title)
        // would otherwise miss → inverse returns null → no undo row →
        // `on_record_failure` drops the backup → original text unrecoverable.
        // Mirrors the link→text branch below.
        const linkTitle = resolved?.extra?.oldTitle;
        const linkColumnId = ((result as { columns?: any[] })?.columns ?? []).find(
          (c) => isLinksOrLTAR(c) && c?.title === linkTitle,
        )?.id;
        if (!linkColumnId) return null;
        const prevSnap = resolved?.extra?.prev as Record<string, unknown>;
        // The internal `columnUpdate` carries neither `fk_model_id` nor
        // `tableId` in params — fall back to the owning table captured by
        // `before` so the recreate target resolves.
        const fkModelId =
          (params.column as { fk_model_id?: string })?.fk_model_id ??
          params.tableId ??
          resolved?.extra?.fkModelId;
        return {
          name: OperationName.columnRevertLinkToText,
          params: {
            linkColumnId,
            textColumn: {
              ...(prevSnap ?? {}),
              id: params.columnId,
              fk_model_id: fkModelId,
            },
            ...(fkModelId ? { tableId: fkModelId } : {}),
          },
        };
      }

      // link→SingleLineText conversion: the link column is replaced by a new
      // text column. Invert via `columnRevertTextToLink` (drop the text column,
      // recreate the link with its original id, re-link rows from the joined
      // text). Link config comes from the `before` snapshot; the new text
      // column id is read from the forward result.
      if (
        isLinksOrLTAR({ uidt: convFromUidt }) &&
        convToUidt === UITypes.SingleLineText
      ) {
        const linkConfig = resolved?.extra?.linkConfig;
        if (!linkConfig) return null;
        const oldTitle = resolved?.extra?.oldTitle;
        const textColumnId = ((result as { columns?: any[] })?.columns ?? []).find(
          (c) => c?.uidt === UITypes.SingleLineText && c?.title === oldTitle,
        )?.id;
        if (!textColumnId) return null;
        return {
          name: OperationName.columnRevertTextToLink,
          params: {
            textColumnId,
            link: linkConfig,
            ...(params.tableId ? { tableId: params.tableId } : {}),
          },
        };
      }

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

/**
 * Inverse of a SingleLineText→link conversion. Only ever dispatched as the
 * `inverse_op` of a `columnUpdate` conversion row (never recorded standalone),
 * so it needs no `undo`/`sandbox` section — just a handler. Drops the link
 * column, recreates the text column (original id), and restores its data from
 * the backup carried on the originating row's `meta.backup`.
 */
export const ColumnRevertLinkToTextContract: OperationContract<
  typeof columnRevertLinkToTextSchema,
  Record<string, any>,
  Column | undefined
> = {
  name: OperationName.columnRevertLinkToText,
  entity: MetaTable.COLUMNS,
  schema: columnRevertLinkToTextSchema,
  entry: {
    entity_id: (params) => (params.textColumn as { id?: string })?.id,
    entity_title: (params) => (params.textColumn as { title?: string })?.title,
    parent_id: (params) =>
      params.tableId ??
      (params.textColumn as { fk_model_id?: string })?.fk_model_id,
    description: fieldActions.edit,
  },
};

/**
 * Inverse of a link→SingleLineText conversion. Only ever dispatched as the
 * `inverse_op` of a `columnUpdate` conversion row (never recorded standalone),
 * so it needs no `undo`/`sandbox` section — just a handler. Drops the text
 * column, recreates the link column (original id) and re-links each row by
 * resolving its joined display values back to related records.
 */
export const ColumnRevertTextToLinkContract: OperationContract<
  typeof columnRevertTextToLinkSchema,
  Record<string, any>,
  Column | undefined
> = {
  name: OperationName.columnRevertTextToLink,
  entity: MetaTable.COLUMNS,
  schema: columnRevertTextToLinkSchema,
  entry: {
    entity_id: (params) => (params.link as { id?: string })?.id,
    entity_title: (params) => (params.link as { title?: string })?.title,
    parent_id: (params) =>
      params.tableId ?? (params.link as { fk_model_id?: string })?.fk_model_id,
    description: fieldActions.edit,
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

      // Redo of a text→link conversion: reuse the originally-created link ids
      // so later ops referencing them stay valid. Redo of a link→text
      // conversion: reuse the originally-created text column id.
      if (isReplay()) {
        const ltarIds = meta.extra?.ltar;
        if (ltarIds) setReplay('ltarReplayIds', ltarIds);
        const linkColumnId = meta.extra?.convertedLink?.linkColumnId;
        if (linkColumnId) setReplay('convertedLinkId', linkColumnId);
        const textColumnId = meta.extra?.convertedText?.textColumnId;
        if (textColumnId) setReplay('convertedTextId', textColumnId);
      }

      type ColumnUpdateSvcParams = Parameters<typeof svc.columnUpdate>[1] & {
        forceUpdateSystem?: boolean;
        bypassSyncedFieldGuard?: boolean;
      };
      const svcParams: ColumnUpdateSvcParams = {
        ...params,
        ...(isReplay()
          ? { forceUpdateSystem: true, bypassSyncedFieldGuard: true }
          : {}),
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

  OperationRegistry.register(
    ColumnRevertLinkToTextContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.revertLinkColumnToText(context, {
        linkColumnId: params.linkColumnId,
        textColumn: params.textColumn as Record<string, any>,
        backupRef: meta.extra?.backup,
        req,
      });
    },
  );

  OperationRegistry.register(
    ColumnRevertTextToLinkContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.revertTextColumnToLink(context, {
        textColumnId: params.textColumnId,
        link: params.link as Parameters<
          typeof svc.revertTextColumnToLink
        >[1]['link'],
        req,
      });
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
