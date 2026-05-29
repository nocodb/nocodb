import { UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { Column, Model } from '~/models';
import { Filter } from '~/models';
import {
  _wherePk,
  deletedColValue,
  getCompositePkValue,
} from '~/helpers/dbHelpers';
import { decodeEventId, encodeEventId } from '~/ee/helpers/trashHelpers';
import conditionV2 from '~/db/conditionV2';

/**
 * Composite resource_id used by record-type BaseTrash entries:
 * `${tableId}:${eventId}` where eventId encodes (deletedBy, deletedAtIso).
 * eventId uses `::` as its separator so it doesn't collide with the `:`
 * gluing tableId on the front.
 *
 * Example: `mxxx:usr_yyy::2026-04-25T12:34:56.789Z`
 */
export function buildRecordResourceId(
  tableId: string,
  fkUserId: string | null | undefined,
  deletedAtIso: string,
): string {
  return `${tableId}:${encodeEventId(fkUserId, deletedAtIso)}`;
}

export function parseRecordResourceId(
  resourceId: string,
): { tableId: string; fkUserId: string | null; deletedAt: Date } | null {
  // Split on the FIRST `:` only — eventId itself contains `::`.
  const idx = resourceId.indexOf(':');
  if (idx <= 0) return null;
  const tableId = resourceId.slice(0, idx);
  const eventId = resourceId.slice(idx + 1);
  const decoded = decodeEventId(eventId);
  if (!decoded) return null;
  return { tableId, ...decoded };
}

/**
 * Batch size for restore / permanent-delete / empty-trash loops. Kept small
 * so per-batch state (preRestoreRows, linked-record broadcasts, audit inserts)
 * stays bounded for events of any size.
 */
export const TRASH_BATCH_SIZE = 100;

/**
 * Per-row conflict discovered by the restore pre-flight. The `kind`
 * discriminator carries both what to show the user and what the apply
 * step has to do to resolve it when force/partial is used.
 *
 *   - link-v1     → null `fkColumnName` on `rowId`
 *   - link-v2     → delete the junction row at (rowId, anchorPk) on colId
 *   - validation  → null `columnName` on `rowId`
 *   - unique-active → null `columnName` on `rowId`
 *   - unique-intra → null `columnName` on `rowId` (winner keeps the value)
 */
export type RestoreConflict =
  | {
      kind: 'link-v1';
      rowId: string;
      columnId: string;
      columnTitle: string;
      fkColumnName: string;
    }
  | {
      kind: 'link-v2';
      rowId: string;
      columnId: string;
      columnTitle: string;
      anchorPk: unknown;
    }
  | {
      kind: 'validation';
      rowId: string;
      columnId: string;
      columnTitle: string;
      columnName: string;
      value: unknown;
      message: string;
    }
  | {
      kind: 'unique-active';
      rowId: string;
      columnId: string;
      columnTitle: string;
      columnName: string;
      value: unknown;
      conflictingRowId: string;
    }
  | {
      kind: 'unique-intra';
      rowId: string;
      columnId: string;
      columnTitle: string;
      columnName: string;
      value: unknown;
      winnerRowId: string;
    };

/**
 * Per-row resolution plan built from conflicts. `nullColumns` are columns
 * to set to NULL in the restore UPDATE; `junctionDeletes` are V2 junction
 * rows to remove so the active rival's link stands.
 */
export type RowResolution = {
  nullColumns: Set<string>;
  junctionDeletes: Array<{ colId: string; anchorPk: unknown }>;
};

/**
 * Apply a WHERE clause that matches any of the given PK values,
 * supporting both single and composite primary keys.
 */
export function whereInPks(
  qb: Knex.QueryBuilder,
  primaryKeys: Column[],
  ids: unknown[],
): Knex.QueryBuilder {
  if (primaryKeys.length === 1) {
    return qb.whereIn(primaryKeys[0].column_name, ids);
  }
  return qb.where(function () {
    for (const id of ids) {
      this.orWhere(_wherePk(primaryKeys, id, true));
    }
  });
}

/**
 * Batch iterator used by restore / permanent-delete.
 *   - event path: RLS-filtered query against the base table, keyset-paginated
 *     on the first PK column (`pk > afterPk`). Timestamp is formatted as a
 *     UTC wall-clock string because the column is `timestamp without time
 *     zone` storing bare UTC — passing a JS Date lets pg serialize in the
 *     server's local TZ and the comparison fails.
 *   - rowIds path: slice the pre-filtered (RLS-applied) list by offset.
 */
export function makeTrashBatchIterator(
  baseModel: any,
  model: Model,
  deletedColumn: Column,
  decoded: { fkUserId: string | null; deletedAt: Date } | null,
  rowIdsPath: string[],
): () => Promise<string[]> {
  let afterPk: string | null = null;
  let rowIdsOffset = 0;

  const lmtCol = model.columns.find(
    (c) => c.uidt === UITypes.LastModifiedTime && c.system,
  );
  const lmbCol = model.columns.find(
    (c) => c.uidt === UITypes.LastModifiedBy && c.system,
  );
  const primaryKeys = model.primaryKeys;
  const pkColNames = primaryKeys.map((pk) => pk.column_name);
  const pkOrderCol = primaryKeys[0].column_name;
  const lmtValue = decoded
    ? decoded.deletedAt.toISOString().replace('T', ' ').replace('Z', '')
    : null;

  return async () => {
    if (!decoded) {
      const batch = rowIdsPath.slice(
        rowIdsOffset,
        rowIdsOffset + TRASH_BATCH_SIZE,
      );
      rowIdsOffset += TRASH_BATCH_SIZE;
      return batch;
    }

    if (!lmtCol) return [];

    const qb = baseModel
      .dbDriver(baseModel.tnPath)
      .where(deletedColumn.column_name, deletedColValue(baseModel, true))
      .where(lmtCol.column_name, lmtValue)
      .orderBy(pkOrderCol)
      .limit(TRASH_BATCH_SIZE)
      .select(pkColNames);

    if (lmbCol) {
      if (decoded.fkUserId === null) {
        qb.whereNull(lmbCol.column_name);
      } else {
        qb.where(lmbCol.column_name, decoded.fkUserId);
      }
    }

    if (afterPk != null) {
      qb.where(pkOrderCol, '>', afterPk);
    }

    const rlsConditions = await baseModel.getRlsConditions();
    if (rlsConditions?.length) {
      await conditionV2(
        baseModel,
        [new Filter({ children: rlsConditions, is_group: true })],
        qb,
      );
    }

    const rows = await qb;
    const batch = rows.map((r: Record<string, any>) =>
      String(getCompositePkValue(primaryKeys, r)),
    );
    if (batch.length) afterPk = batch[batch.length - 1];
    return batch;
  };
}

/**
 * Filter a list of rowIds down to the subset visible under the current user's
 * RLS policies. `requireDeleted: true` (default) also filters to soft-deleted
 * rows — anything dropped is treated the same as "does not exist" by callers.
 * Pass `false` to get RLS-only filtering (callers then decide what to do with
 * active rows — e.g. permanentDelete wants to throw 422).
 */
export async function filterRowIdsByRls(
  baseModel: any,
  model: Model,
  deletedColumn: Column,
  rowIds: string[],
  opts: { requireDeleted?: boolean } = {},
): Promise<string[]> {
  if (!rowIds?.length) return [];

  const primaryKeys = model.primaryKeys;
  const pkColNames = primaryKeys.map((pk) => pk.column_name);

  const qb = whereInPks(
    baseModel.dbDriver(baseModel.tnPath),
    primaryKeys,
    rowIds,
  ).select(pkColNames);

  if (opts.requireDeleted !== false) {
    qb.where(deletedColumn.column_name, deletedColValue(baseModel, true));
  }

  const rlsConditions = await baseModel.getRlsConditions();
  if (rlsConditions?.length) {
    await conditionV2(
      baseModel,
      [new Filter({ children: rlsConditions, is_group: true })],
      qb,
    );
  }

  const rows = await qb;
  return rows.map((r: Record<string, any>) =>
    String(getCompositePkValue(primaryKeys, r)),
  );
}
