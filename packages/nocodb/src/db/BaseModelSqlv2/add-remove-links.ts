import {
  AuditV1OperationTypes,
  isDeletedCol,
  isLinksOrLTAR,
  isLinkV2,
  isMMOrMMLike,
  ncIsNullOrUndefined,
  RelationTypes,
} from 'nocodb-sdk';
import BigNumber from 'bignumber.js';
import { Logger } from '@nestjs/common';
import type { AuditOperationSubTypes, NcRequest } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type CustomKnex from '~/db/CustomKnex';
import type { NestedLinkLastModifiedEntry } from '~/db/BaseModelSqlv2/nested-link-preparator';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import type { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import { COMPOUND_SELECT_CHUNK_SIZE } from '~/constants';
import { chunkArray } from '~/utils/tsUtils';
import {
  _wherePk,
  dataWrapper,
  deletedColValue,
  extractIds,
  getOppositeRelationType,
  getRelatedLinksColumn,
  touchedLinkColumnIds,
} from '~/helpers/dbHelpers';
import { Model } from '~/models';

const logger = new Logger('AddRemoveLinks');

/**
 * Extract the corresponding link column in the referencing table using a given LTAR column and the referenced table
 * @param context - The NcContext
 * @param param - Object containing ltarColumn and optionally referencedTable or referencedTableColumns
 * @returns The corresponding link column in the referenced table, or null if not found
 */
export const extractCorrespondingLinkColumn = async (
  context: NcContext,
  param: {
    ltarColumn: Column;
    referencedTable?: Model;
    referencedTableColumns?: Column[];
  },
): Promise<Column | null> => {
  const { ltarColumn } = param;

  if (!isLinksOrLTAR(ltarColumn)) {
    return null;
  }

  const colOptions = await ltarColumn.getColOptions();

  const { refContext } = colOptions.getRelContext();

  // Get the table that contains the LTAR column
  const sourceTableId = ltarColumn.fk_model_id;

  // Get columns from the referenced table or use provided columns
  let columnsInReferencedTable: Column[];
  if (param.referencedTableColumns) {
    columnsInReferencedTable = param.referencedTableColumns;
  } else if (param.referencedTable) {
    columnsInReferencedTable =
      param.referencedTable.columns ||
      (await param.referencedTable.getColumns());
  } else {
    // Extract referenced table columns from ref table ID if not provided
    const refTableId = colOptions.fk_related_model_id;
    const refTable = await Model.get(refContext, refTableId);
    columnsInReferencedTable =
      refTable.columns || (await refTable.getColumns());
  }

  // Find the corresponding link column based on the relation type
  for (const column of columnsInReferencedTable) {
    if (!isLinksOrLTAR(column)) continue;

    const refColOptions = await column.getColOptions();

    // A link column can outlive its `nc_col_relations` row, leaving a system
    // `_nc_m2m_*` column with no colOptions. It can never be the mirror, and
    // dereferencing it 500s every link write into this table. nocohub#10868
    if (!refColOptions) continue;

    // Check if this column links back to the source table
    if (refColOptions.fk_related_model_id !== sourceTableId) continue;

    // Handle different relation types
    switch (colOptions.type) {
      case RelationTypes.HAS_MANY:
        // For HM, the referenced table should have a BT column and parent child will remain same
        if (
          refColOptions.type === RelationTypes.BELONGS_TO &&
          refColOptions.fk_child_column_id === colOptions.fk_child_column_id &&
          refColOptions.fk_parent_column_id === colOptions.fk_parent_column_id
        ) {
          return column;
        }
        break;

      case RelationTypes.BELONGS_TO:
        // For BT, the referenced table should have an HM column, and parent child will remain same
        if (
          refColOptions.type === RelationTypes.HAS_MANY &&
          refColOptions.fk_child_column_id === colOptions.fk_child_column_id &&
          refColOptions.fk_parent_column_id === colOptions.fk_parent_column_id
        ) {
          return column;
        }
        break;

      case RelationTypes.ONE_TO_ONE:
        // For OO, the referenced table should have an OO column and parent child will remain same
        if (
          refColOptions.type === RelationTypes.ONE_TO_ONE &&
          refColOptions.fk_child_column_id === colOptions.fk_child_column_id &&
          refColOptions.fk_parent_column_id === colOptions.fk_parent_column_id
        ) {
          return column;
        }
        break;

      case RelationTypes.MANY_TO_MANY:
        // For MM, check if the referenced table has an MM column that references the same junction table
        // and the parent-child columns are swapped
        if (
          refColOptions.type === RelationTypes.MANY_TO_MANY &&
          refColOptions.fk_mm_model_id === colOptions.fk_mm_model_id && // Same junction table
          refColOptions.fk_related_model_id === sourceTableId
        ) {
          // Additional check for MM columns to ensure they're properly linked
          // The junction table ID (fk_mm_model_id) is already verified above
          if (
            refColOptions.fk_mm_parent_column_id ===
              colOptions.fk_mm_child_column_id &&
            refColOptions.fk_mm_child_column_id ===
              colOptions.fk_mm_parent_column_id
          ) {
            return column;
          }
        }
        break;
    }
  }

  return null;
};

/**
 * Transaction Handling Strategy for Link Operations:
 *
 * This module handles adding and removing links between records. To prevent transaction
 * conflicts and ensure reliable broadcasting of link updates, we use a specific pattern:
 *
 * 1. Core link operations (insert/delete) run within the main transaction
 * 2. Broadcasting operations use non-transactional clones to avoid conflicts
 * 3. This separation ensures that broadcasting doesn't interfere with the main
 *    transaction's commit/rollback behavior
 *
 * The getNonTransactionalClone() method creates a new BaseModelSqlv2 instance
 * that uses the base database driver instead of any active transaction, allowing
 * broadcasting operations to run independently.
 */

const isWebhookIgnored = (req: NcRequest) => {
  const ignoreWebhook = req?.query?.ignoreWebhook;
  return ignoreWebhook !== undefined && ignoreWebhook !== 'false';
};

/** One link field written on `rowIds`, as {@link captureLinkHooks} reads it. */
export interface LinkHookChange {
  /** Link field on the written table */
  column: Column;
  /** Existing rows on the written side; empty for a row being inserted */
  rowIds: unknown[];
  /** Rows on the other side that are linked or unlinked */
  refRowIds: unknown[];
  /** The part of `refRowIds` being linked, whose current partners can be displaced */
  linkedRefRowIds: unknown[];
  /** Per row (`String(rowId)`), the refs that replace its links: rows linked today are unlinked */
  replace?: Map<string, unknown[]>;
}

const noopFire = () => {};

/**
 * `[id, partner]` pairs for the rows on the other side of `column` that `ids`
 * link to today. `fromRef` reads from the related table's side. Only single-pk
 * tables whose link stores the pk are resolved; others return nothing.
 */
const readLinkPartners = async ({
  baseModel,
  column,
  ids,
  fromRef,
  trx,
}: {
  baseModel: IBaseModelSqlV2;
  column: Column;
  ids: unknown[];
  fromRef: boolean;
  trx?: Knex.Transaction;
}): Promise<[unknown, unknown][]> => {
  if (!ids.length) return [];
  const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();
  const { childContext, mmContext } = await colOptions.getParentChildContext();
  const childColumn = await colOptions.getChildColumn();
  const parentColumn = await colOptions.getParentColumn();
  const childTable = await childColumn.getModel();
  const parentTable = await parentColumn.getModel();
  await childTable.getColumns();
  await parentTable.getColumns();
  if (
    childTable.primaryKeys.length !== 1 ||
    parentTable.primaryKeys.length !== 1 ||
    !parentColumn.pk
  ) {
    return [];
  }

  const partners: [unknown, unknown][] = [];
  if (isMMOrMMLike(column)) {
    if (!childColumn.pk) return [];
    // The junction's child side is the written table
    const vTable = await colOptions.getMMModel();
    const vChildCol = await colOptions.getMMChildColumn();
    const vParentCol = await colOptions.getMMParentColumn();
    const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
      model: vTable,
      dbDriver: trx ?? baseModel.dbDriver,
    });
    const [from, to] = fromRef
      ? [vParentCol.column_name, vChildCol.column_name]
      : [vChildCol.column_name, vParentCol.column_name];
    for (const chunk of chunkArray(ids, COMPOUND_SELECT_CHUNK_SIZE)) {
      const rows = await assocBaseModel.execAndParse(
        assocBaseModel
          .dbDriver(assocBaseModel.getTnPath(vTable))
          .select(from, to)
          .whereIn(from, chunk),
        null,
        { raw: true },
      );
      partners.push(...rows.map((r): [unknown, unknown] => [r[from], r[to]]));
    }
  } else {
    // The FK sits on the child table and points at the parent's pk
    const childBaseModel = await Model.getBaseModelSQL(childContext, {
      model: childTable,
      dbDriver: trx ?? baseModel.dbDriver,
    });
    const ownIsChild =
      colOptions.type === RelationTypes.BELONGS_TO ||
      (colOptions.type === RelationTypes.ONE_TO_ONE && !!column.meta?.bt);
    const fromChild = ownIsChild !== fromRef;
    const [from, to] = fromChild
      ? [childTable.primaryKey.column_name, childColumn.column_name]
      : [childColumn.column_name, childTable.primaryKey.column_name];
    for (const chunk of chunkArray(ids, COMPOUND_SELECT_CHUNK_SIZE)) {
      const rows = await childBaseModel.execAndParse(
        childBaseModel
          .dbDriver(childBaseModel.getTnPath(childTable))
          .select(from, to)
          .whereIn(from, chunk),
        null,
        { raw: true },
      );
      partners.push(...rows.map((r): [unknown, unknown] => [r[from], r[to]]));
    }
  }
  return partners.filter(([, id]) => !ncIsNullOrUndefined(id));
};

/**
 * Reads every existing record whose link field a write changes, before the
 * write: the written rows, the rows on the other side, and rows that lose a
 * link as a side effect (a single-record link replaced). Returns a function
 * that reads them again once the write commits and fires their update hooks.
 * A table without an after-update subscriber is never read.
 */
export const captureLinkHooks = async ({
  baseModel,
  changes,
  req,
  notifiedRowIds = [],
  trx,
}: {
  baseModel: IBaseModelSqlV2;
  changes: LinkHookChange[];
  req: NcRequest;
  /** Rows of `baseModel` whose update hooks the write fires itself */
  notifiedRowIds?: unknown[];
  /**
   * The write's open transaction, once it has written: reads go through it,
   * since on MSSQL a read on another connection waits on its locks
   */
  trx?: Knex.Transaction;
}): Promise<
  // The driver whose commit the hooks wait for
  (driver?: CustomKnex | Knex.Transaction) => unknown
> => {
  if (isWebhookIgnored(req) || !changes.length) return noopFire;

  const listened = new Map<string, Promise<boolean>>();
  const isListened = (model: IBaseModelSqlV2) => {
    if (!listened.has(model.model.id)) {
      listened.set(model.model.id, model.hasActiveUpdateHooks());
    }
    return listened.get(model.model.id);
  };

  const targets = new Map<string, { model: IBaseModelSqlV2; ids: unknown[] }>();
  const addTargets = (model: IBaseModelSqlV2, ids: unknown[]) => {
    if (!ids.length) return;
    if (!targets.has(model.model.id)) {
      targets.set(model.model.id, { model, ids: [] });
    }
    targets.get(model.model.id).ids.push(...ids);
  };

  for (const change of changes) {
    const { column } = change;
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();
    const { refContext } = await colOptions.getParentChildContext();
    const refModel = await Model.get(
      refContext,
      colOptions.fk_related_model_id,
    );
    await refModel.getColumns();
    const refBaseModel = await Model.getBaseModelSQL(refContext, {
      model: refModel,
      dbDriver: baseModel.dbDriver,
    });

    const toRefId = (id: unknown) =>
      id && typeof id === 'object'
        ? refBaseModel.extractPksValues(id, true)
        : id;
    const rowIds = change.rowIds.filter((id) => !ncIsNullOrUndefined(id));
    let refRowIds = change.refRowIds.map(toRefId);
    const linkedRefRowIds = change.linkedRefRowIds.map(toRefId);

    const type = colOptions.type as RelationTypes;
    // Written rows hold one link, so linking replaces the current one
    const ownSingle = [
      RelationTypes.BELONGS_TO,
      RelationTypes.ONE_TO_ONE,
      RelationTypes.MANY_TO_ONE,
    ].includes(type);
    // Related rows hold one link, so linking takes them from their current row
    const refSingle = [
      RelationTypes.HAS_MANY,
      RelationTypes.ONE_TO_ONE,
      RelationTypes.ONE_TO_MANY,
    ].includes(type);

    const ownListened = await isListened(baseModel);
    const refListened =
      !!getRelatedLinksColumn(column, refModel) &&
      (await isListened(refBaseModel));

    if (ownListened) {
      addTargets(baseModel, rowIds);
    }
    if (refListened) {
      if (change.replace || (ownSingle && linkedRefRowIds.length)) {
        const current = await readLinkPartners({
          baseModel,
          column,
          ids: rowIds,
          fromRef: false,
          trx,
        });
        if (change.replace) {
          const currentByRow = new Map<string, string[]>();
          for (const [rowId, refId] of current) {
            const key = String(rowId);
            if (!currentByRow.has(key)) currentByRow.set(key, []);
            currentByRow.get(key).push(String(refId));
          }
          // Only rows whose link actually flips: unlinked plus newly linked
          refRowIds = [];
          for (const [rowId, sent] of change.replace) {
            const sentIds = sent.map(toRefId);
            const next = new Set(sentIds.map(String));
            const now = currentByRow.get(rowId) ?? [];
            const nowSet = new Set(now);
            refRowIds.push(
              ...now.filter((id) => !next.has(id)),
              ...sentIds.filter((id) => !nowSet.has(String(id))),
            );
          }
        } else {
          refRowIds = [...refRowIds, ...current.map(([, refId]) => refId)];
        }
      }
      addTargets(refBaseModel, refRowIds);
    }
    if (ownListened && refSingle && linkedRefRowIds.length) {
      const written = new Set(rowIds.map(String));
      addTargets(
        baseModel,
        (
          await readLinkPartners({
            baseModel,
            column,
            ids: linkedRefRowIds,
            fromRef: true,
            trx,
          })
        )
          .map(([, id]) => id)
          .filter((id) => !written.has(String(id))),
      );
    }
  }
  // Those rows already get one event from the write
  const notified = new Set(notifiedRowIds.map(String));
  const own = targets.get(baseModel.model.id);
  if (own && notified.size) {
    own.ids = own.ids.filter((id) => !notified.has(String(id)));
  }
  const sides = [...targets.values()].filter((side) => side.ids.length);
  if (!sides.length) return noopFire;

  const prevRows: Record<string, any>[][] = [];
  for (const side of sides) {
    prevRows.push(await side.model.readRowsForLinkHooks(side.ids, trx));
  }

  const fire = async () => {
    try {
      for (const [i, side] of sides.entries()) {
        const clone = side.model.getNonTransactionalClone();
        await clone.afterLinkUpdate(
          prevRows[i],
          await clone.readRowsForLinkHooks(side.ids),
          req,
        );
      }
    } catch (e) {
      logger.error(e?.message, e?.stack);
    }
  };
  // Off a transaction this runs now
  return (driver = baseModel.dbDriver) =>
    'attachToTransaction' in driver ? driver.attachToTransaction(fire) : fire();
};

/** {@link captureLinkHooks} for one row's link field written outside `addLinks` / `removeLinks`. */
export const captureLinkHookRowsForColumn = ({
  baseModel,
  column,
  rowId,
  refRowIds,
  linkedRefRowIds,
  req,
}: {
  baseModel: IBaseModelSqlV2;
  column: Column;
  rowId: string;
  refRowIds: unknown[];
  linkedRefRowIds: unknown[];
  req: NcRequest;
}) =>
  captureLinkHooks({
    baseModel,
    changes: [{ column, rowIds: [rowId], refRowIds, linkedRefRowIds }],
    req,
  });

/** {@link captureLinkHooks} for the links a nested insert writes. */
export const captureNestedLinkHooks = ({
  baseModel,
  entries,
  req,
}: {
  baseModel: IBaseModelSqlV2;
  entries: NestedLinkLastModifiedEntry[];
  req: NcRequest;
}) =>
  captureLinkHooks({
    baseModel,
    changes: entries.map(({ col, nestedData }) => {
      const ids = (
        Array.isArray(nestedData) ? nestedData : [nestedData]
      ).filter((d) => !ncIsNullOrUndefined(d) && d !== '');
      // The inserted row only gets after.insert
      return { column: col, rowIds: [], refRowIds: ids, linkedRefRowIds: ids };
    }),
    req,
  });

export const addOrRemoveLinks = (baseModel: IBaseModelSqlV2) => {
  const validateRefIds = (
    refIds: (string | number | Record<string, any>)[],
    refModel: Model,
  ) => {
    for (const refId of Array.isArray(refIds) ? refIds : [refIds]) {
      if (typeof refId === 'object') {
        for (const primaryKey of refModel.primaryKeys) {
          if (
            ncIsNullOrUndefined(
              dataWrapper(refId).getByColumnNameTitleOrId(primaryKey),
            )
          ) {
            NcError.get(baseModel.context).unprocessableEntity(
              `Validation failed: Missing primary key column "${
                primaryKey.title
              }" in request for model "${
                refModel.title
              }". RefId: ${JSON.stringify(refId)}`,
            );
          }
        }
      } else if (ncIsNullOrUndefined(refId)) {
        NcError.get(baseModel.context).unprocessableEntity(
          `Validation failed: Invalid id "${JSON.stringify(
            refId,
          )}" for model "${refModel.title}".`,
        );
      }
    }
  };

  const addLinks = async ({
    cookie,
    childIds: _childIds,
    colId,
    rowId,
    triggerUpdateHooks = false,
  }: {
    cookie: any;
    childIds: (string | number)[];
    colId: string;
    rowId: string;
    // Fire after-update hooks for the linked records — user-facing link calls only
    triggerUpdateHooks?: boolean;
  }) => {
    await baseModel.model.getColumns();
    const column = baseModel.model.columnsById[colId];

    if (!column || !isLinksOrLTAR(column))
      NcError.get(baseModel.context).fieldNotFound(colId);

    const row = await baseModel.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    // validate rowId
    if (!row) {
      NcError.get(baseModel.context).recordNotFound(rowId);
    }

    if (!_childIds.length) return;

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const { childContext, parentContext, mmContext } =
      await colOptions.getParentChildContext();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    // The related table and its columns are loaded already, so the mirror lookup reuses them
    const linkColIds = touchedLinkColumnIds(
      column.id,
      (
        await extractCorrespondingLinkColumn(baseModel.context, {
          ltarColumn: column,
          referencedTable: [parentTable, childTable].find(
            (table) => table.id === colOptions.fk_related_model_id,
          ),
        })
      )?.id,
    );

    const childBaseModel = await Model.getBaseModelSQL(childContext, {
      model: childTable,
      dbDriver: baseModel.dbDriver,
    });

    const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
      model: parentTable,
      dbDriver: baseModel.dbDriver,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    let relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;
    // v2 link-records body sends `[{Id: x}, ...]`; normalize to primitive PKs once
    // so downstream audit + broadcast paths don't stringify objects as '[object Object]'.
    let childIds = _childIds.map((id) =>
      id !== null && typeof id === 'object'
        ? childBaseModel.extractPksValues(id, true)
        : id,
    );

    const relatedChildCol = getRelatedLinksColumn(
      column,
      baseModel.model.id === parentTable.id ? childTable : parentTable,
    );

    const auditConfig = {
      childModel: childTable,
      parentModel: parentTable,
      childColTitle: relatedChildCol?.title || '',
      parentColTitle: column.title,
      childColId: relatedChildCol?.id || '',
      parentColId: column.id,
    } as {
      childModel: Model;
      parentModel: Model;
      childColTitle: string;
      parentColTitle: string;
      childColId: string;
      parentColId: string;
    };

    const fireLinkHooks = triggerUpdateHooks
      ? await captureLinkHookRowsForColumn({
          baseModel,
          column,
          rowId,
          refRowIds: childIds,
          linkedRefRowIds: childIds,
          req: cookie,
        })
      : null;

    if (relationType === RelationTypes.ONE_TO_ONE) {
      relationType = column.meta?.bt
        ? RelationTypes.BELONGS_TO
        : RelationTypes.HAS_MANY;
      childIds = childIds.slice(0, 1);

      validateRefIds(
        childIds,
        relationType === RelationTypes.BELONGS_TO ? parentTable : childTable,
      );

      // unlink
      await baseModel.execAndParse(
        baseModel
          .dbDriver(childTn)
          .where({
            [childColumn.column_name]: baseModel.dbDriver.from(
              baseModel
                .dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(
                  _wherePk(
                    parentTable.primaryKeys,
                    column.meta?.bt ? childIds[0] : rowId,
                  ),
                )
                .first()
                .as('___cn_alias'),
            ),
          })
          .update({ [childColumn.column_name]: null }),
        null,
        { raw: true },
      );

      auditConfig.parentModel = column.meta?.bt ? childTable : parentTable;
      auditConfig.childModel = column.meta?.bt ? parentTable : childTable;
      if (column.meta?.bt) {
        auditConfig.parentColTitle = relatedChildCol?.title || '';
        auditConfig.parentColId = relatedChildCol?.id || '';
        auditConfig.childColTitle = column.title;
        auditConfig.childColId = column.id;
      }
    }

    switch (relationType) {
      case RelationTypes.MANY_TO_MANY:
        {
          // V2 mo/oo: child can only link to one parent — truncate to 1
          if (isLinkV2(column) && ['mo', 'oo'].includes(colOptions.type)) {
            childIds = childIds.slice(0, 1);
          }

          validateRefIds(childIds, parentTable);

          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: vTable,
            dbDriver: baseModel.dbDriver,
          });

          const refBaseModel = parentBaseModel;

          const vTn = assocBaseModel.getTnPath(vTable);

          let insertData: Record<string, any>[];

          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(parentTn)
              .select(`${parentTn}.${parentColumn.column_name}`)
              .select(`${vTn}.${vChildCol.column_name}`)
              .leftJoin(vTn, (qb) => {
                qb.on(
                  `${vTn}.${vParentCol.column_name}`,
                  `${parentTn}.${parentColumn.column_name}`,
                ).andOn(
                  `${vTn}.${vChildCol.column_name}`,
                  baseModel.dbDriver.raw('?', [
                    row[childColumn.title] ?? row[childColumn.column_name],
                  ]),
                );
              });

            // Exclude soft-deleted target rows — otherwise the link succeeds
            // but the linked record is invisible under the read filter.
            const parentSoftDeleteFilter =
              await refBaseModel.getSoftDeleteFilter();
            if (parentSoftDeleteFilter) {
              childRowsQb.where(parentSoftDeleteFilter);
            }

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else {
              childRowsQb.whereIn(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
                typeof childIds[0] === 'object'
                  ? childIds.map((c) =>
                      dataWrapper(c).getByColumnNameTitleOrId(
                        parentTable.primaryKey,
                      ),
                    )
                  : childIds,
              );
            }

            if (parentTable.primaryKey.column_name !== parentColumn.column_name)
              childRowsQb.select(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
              );

            const childRows = await refBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                raw: true,
              },
            );

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find((r) => r[parentColumn.column_name] === id),
              );

              NcError.get(baseModel.context).recordNotFound(
                extractIds(missingIds),
              );
            }

            insertData = childRows
              // skip existing links
              .filter((childRow) => !childRow[vChildCol.column_name])
              // generate insert data for new links
              .map((childRow) => ({
                [vParentCol.column_name]:
                  dataWrapper(childRow).getByColumnNameTitleOrId(parentColumn),
                [vChildCol.column_name]:
                  dataWrapper(row).getByColumnNameTitleOrId(childColumn),
              }));

            // if no new links, return true
            if (!insertData.length) return true;
          }

          // V2 cardinality enforcement: remove conflicting junction rows before insert
          if (
            isLinkV2(column) &&
            colOptions.type !== RelationTypes.MANY_TO_MANY
          ) {
            const unlinkAuditParentObj = [];
            const unlinkAuditChildObj = [];

            // mo/oo: child can only link to one parent — clear existing child links
            // Preserve junction rows where the parent is soft-deleted so that
            // restore conflict detection can detect them on restore.
            if (['mo', 'oo'].includes(colOptions.type)) {
              const childFkValue =
                dataWrapper(row).getByColumnNameTitleOrId(childColumn);

              // Skip rows whose parent is soft-deleted — they are preserved
              // for restore conflict detection and should not be deleted or audited.
              const parentSoftDeleteCol = parentTable.columns.find((c) =>
                isDeletedCol(c),
              );

              const existingQb = baseModel
                .dbDriver(vTn)
                .select(vChildCol.column_name, vParentCol.column_name)
                .where(vChildCol.column_name, childFkValue);

              if (parentSoftDeleteCol) {
                existingQb.whereNotExists(
                  baseModel
                    .dbDriver(parentTn)
                    .select(1)
                    .where(
                      parentSoftDeleteCol.column_name,
                      deletedColValue(baseModel, true),
                    )
                    .whereRaw('?? = ??', [
                      parentTable.primaryKey.column_name,
                      `${vTn}.${vParentCol.column_name}`,
                    ]),
                );
              }

              const existing = await assocBaseModel.execAndParse(
                existingQb,
                null,
                { raw: true },
              );

              if (existing.length) {
                const deleteQb = baseModel
                  .dbDriver(vTn)
                  .where(vChildCol.column_name, childFkValue);

                if (parentSoftDeleteCol) {
                  deleteQb.whereNotExists(
                    baseModel
                      .dbDriver(parentTn)
                      .select(1)
                      .where(
                        parentSoftDeleteCol.column_name,
                        deletedColValue(baseModel, true),
                      )
                      .whereRaw('?? = ??', [
                        parentTable.primaryKey.column_name,
                        `${vTn}.${vParentCol.column_name}`,
                      ]),
                  );
                }

                await assocBaseModel.execAndParse(deleteQb.delete(), null, {
                  raw: true,
                });

                for (const r of existing) {
                  unlinkAuditParentObj.push({
                    rowId: r[vParentCol.column_name],
                    refRowId: r[vChildCol.column_name],
                    type: colOptions.type as RelationTypes,
                  });
                  if (parentTable.id !== childTable.id) {
                    unlinkAuditChildObj.push({
                      rowId: r[vChildCol.column_name],
                      refRowId: r[vParentCol.column_name],
                      type: getOppositeRelationType(colOptions.type),
                    });
                  }
                }
              }
            }

            // om/oo: each parent can only be linked by one child — clear existing parent links
            // Preserve junction rows where the child is soft-deleted so that
            // restore conflict detection can detect them on restore.
            if (['om', 'oo'].includes(colOptions.type)) {
              for (const data of insertData) {
                const parentFkValue = data[vParentCol.column_name];

                // Skip rows whose child is soft-deleted — they are preserved
                // for restore conflict detection and should not be deleted or audited.
                const childSoftDeleteCol = childTable.columns.find((c) =>
                  isDeletedCol(c),
                );

                const existingQb = baseModel
                  .dbDriver(vTn)
                  .select(vChildCol.column_name, vParentCol.column_name)
                  .where(vParentCol.column_name, parentFkValue);

                if (childSoftDeleteCol) {
                  existingQb.whereNotExists(
                    baseModel
                      .dbDriver(childTn)
                      .select(1)
                      .where(
                        childSoftDeleteCol.column_name,
                        deletedColValue(baseModel, true),
                      )
                      .whereRaw('?? = ??', [
                        childTable.primaryKey.column_name,
                        `${vTn}.${vChildCol.column_name}`,
                      ]),
                  );
                }

                const existing = await assocBaseModel.execAndParse(
                  existingQb,
                  null,
                  { raw: true },
                );

                if (existing.length) {
                  const deleteQb = baseModel
                    .dbDriver(vTn)
                    .where(vParentCol.column_name, parentFkValue);

                  if (childSoftDeleteCol) {
                    deleteQb.whereNotExists(
                      baseModel
                        .dbDriver(childTn)
                        .select(1)
                        .where(
                          childSoftDeleteCol.column_name,
                          deletedColValue(baseModel, true),
                        )
                        .whereRaw('?? = ??', [
                          childTable.primaryKey.column_name,
                          `${vTn}.${vChildCol.column_name}`,
                        ]),
                    );
                  }

                  await assocBaseModel.execAndParse(deleteQb.delete(), null, {
                    raw: true,
                  });

                  for (const r of existing) {
                    unlinkAuditParentObj.push({
                      rowId: r[vParentCol.column_name],
                      refRowId: r[vChildCol.column_name],
                      type: colOptions.type as RelationTypes,
                    });
                    if (parentTable.id !== childTable.id) {
                      unlinkAuditChildObj.push({
                        rowId: r[vChildCol.column_name],
                        refRowId: r[vParentCol.column_name],
                        type: getOppositeRelationType(colOptions.type),
                      });
                    }
                  }
                }
              }
            }

            // Emit unlink audit for cascaded removals
            if (unlinkAuditParentObj.length) {
              baseModel.dbDriver.attachToTransaction(async () => {
                const clone = baseModel.getNonTransactionalClone();
                await clone.afterAddOrRemoveChild(
                  {
                    opType: AuditV1OperationTypes.DATA_UNLINK,
                    model: auditConfig.parentModel,
                    refModel: auditConfig.childModel,
                    columnTitle: auditConfig.parentColTitle,
                    columnId: auditConfig.parentColId,
                    refColumnTitle: auditConfig.childColTitle,
                    refColumnId: auditConfig.childColId,
                    req: cookie,
                  },
                  unlinkAuditParentObj,
                );
                if (unlinkAuditChildObj.length) {
                  await clone.afterAddOrRemoveChild(
                    {
                      opType: AuditV1OperationTypes.DATA_UNLINK,
                      model: auditConfig.childModel,
                      refModel: auditConfig.parentModel,
                      columnTitle: auditConfig.childColTitle,
                      columnId: auditConfig.childColId,
                      refColumnTitle: auditConfig.parentColTitle,
                      refColumnId: auditConfig.parentColId,
                      req: cookie,
                    },
                    unlinkAuditChildObj,
                  );
                }
              });
            }
          }

          // Per-link ordering (v2 junctions carrying Order columns): append the
          // new links at the end of each side's order sequence. childOrderCol
          // groups by vChildCol (the current record's side) so all new links go
          // after the current record's existing links; parentOrderCol groups by
          // vParentCol (each linked record's side), appended per linked record.
          const childOrderCol = await colOptions.getMMChildOrderColumn();
          const parentOrderCol = await colOptions.getMMParentOrderColumn();
          if (childOrderCol || parentOrderCol) {
            const currentSideVal =
              dataWrapper(row).getByColumnNameTitleOrId(childColumn);

            let childOrderBase = 0;
            if (childOrderCol) {
              const res = await baseModel
                .dbDriver(vTn)
                .max(`${childOrderCol.column_name} as m`)
                .where(vChildCol.column_name, currentSideVal)
                .first();
              childOrderBase = Number(res?.m ?? 0) || 0;
            }

            const parentMaxByVal: Record<string, number> = {};
            if (parentOrderCol) {
              const parentVals = [
                ...new Set(insertData.map((d) => d[vParentCol.column_name])),
              ];
              if (parentVals.length) {
                const maxRows = await baseModel
                  .dbDriver(vTn)
                  .select(vParentCol.column_name)
                  .max(`${parentOrderCol.column_name} as m`)
                  .whereIn(vParentCol.column_name, parentVals)
                  .groupBy(vParentCol.column_name);
                for (const r of maxRows) {
                  parentMaxByVal[r[vParentCol.column_name]] =
                    Number(r.m ?? 0) || 0;
                }
              }
            }

            insertData = insertData.map((d, i) => {
              const out = { ...d };
              if (childOrderCol) {
                out[childOrderCol.column_name] = childOrderBase + i + 1;
              }
              if (parentOrderCol) {
                const pv = d[vParentCol.column_name];
                const next = (parentMaxByVal[pv] ?? 0) + 1;
                parentMaxByVal[pv] = next;
                out[parentOrderCol.column_name] = next;
              }
              return out;
            });
          }

          // todo: use bulk insert
          for (const chunk of chunkArray(
            insertData,
            COMPOUND_SELECT_CHUNK_SIZE,
          )) {
            await baseModel.execAndParse(
              baseModel.dbDriver(vTn).insert(chunk),
              null,
              {
                raw: true,
              },
            );
          }

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: childIds,
            cookie,
            updatedColIds: [
              (
                await extractCorrespondingLinkColumn(baseModel.context, {
                  ltarColumn: column,
                  referencedTable: parentTable,
                  referencedTableColumns: parentTable.columns,
                })
              )?.id,
            ],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates(childIds as string[], linkColIds);
          });

          await childBaseModel.updateLastModified({
            model: childTable,
            updatedColIds: [column.id],
            rowIds: [rowId],
            cookie,
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await childBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId], linkColIds);
          });

          auditConfig.parentModel =
            baseModel.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            baseModel.model.id === parentTable.id ? childTable : parentTable;
          if (baseModel.model.id !== parentTable.id) {
            auditConfig.parentColTitle = relatedChildCol?.title || '';
            auditConfig.parentColId = relatedChildCol?.id || '';
            auditConfig.childColTitle = column.title;
            auditConfig.childColId = column.id;
          }
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          validateRefIds(childIds, childTable);
          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(childTn)
              .select(childTable.primaryKey.column_name);

            // Exclude soft-deleted target rows — see MM branch above.
            const childSoftDeleteFilter =
              await childBaseModel.getSoftDeleteFilter();
            if (childSoftDeleteFilter) {
              childRowsQb.where(childSoftDeleteFilter);
            }

            if (childTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(childTable.primaryKeys, childId));
                }
              });
            } else {
              childRowsQb.whereIn(
                parentTable.primaryKey.column_name,
                typeof childIds[0] === 'object'
                  ? childIds.map((c) =>
                      dataWrapper(c).getByColumnNameTitleOrId(
                        parentTable.primaryKey,
                      ),
                    )
                  : childIds,
              );
            }

            const childRows = await childBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                raw: true,
              },
            );

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find((r) => r[parentColumn.column_name] === id),
              );

              NcError.get(baseModel.context).recordNotFound(
                extractIds(missingIds),
              );
            }
          }
          const updateQb = baseModel.dbDriver(childTn).update({
            [childColumn.column_name]: baseModel.dbDriver.from(
              baseModel
                .dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(_wherePk(parentTable.primaryKeys, rowId))
                .first()
                .as('___cn_alias'),
            ),
          });
          if (childTable.primaryKeys.length > 1) {
            updateQb.where((qb) => {
              for (const childId of childIds) {
                qb.orWhere(_wherePk(childTable.primaryKeys, childId));
              }
            });
          } else {
            updateQb.whereIn(
              childTable.primaryKey.column_name,
              typeof childIds[0] === 'object'
                ? childIds.map((c) =>
                    dataWrapper(c).getByColumnNameTitleOrId(
                      childTable.primaryKey,
                    ),
                  )
                : childIds,
            );
          }
          await baseModel.execAndParse(updateQb, null, { raw: true });

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
            updatedColIds: [column.id],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId], linkColIds);
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          validateRefIds(childIds, parentTable);
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;
          auditConfig.parentColTitle = relatedChildCol?.title || '';
          auditConfig.parentColId = relatedChildCol?.id || '';
          auditConfig.childColTitle = column.title;
          auditConfig.childColId = column.id;
          const refBaseModel = parentBaseModel;
          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(parentTn)
              .select(parentTable.primaryKey.column_name)
              .where(_wherePk(parentTable.primaryKeys, childIds[0]));

            // Exclude soft-deleted target rows — see MM branch above.
            const parentSoftDeleteFilter =
              await refBaseModel.getSoftDeleteFilter();
            if (parentSoftDeleteFilter) {
              childRowsQb.where(parentSoftDeleteFilter);
            }

            childRowsQb.first();

            const childRow = await refBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                first: true,
                raw: true,
              },
            );

            if (!childRow) {
              NcError.get(baseModel.context).recordNotFound(
                extractIds(childIds, true),
              );
            }
          }

          await childBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              .update({
                [childColumn.column_name]: baseModel.dbDriver.from(
                  baseModel
                    .dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, childIds[0]))
                    // .whereIn(parentTable.primaryKey.column_name, childIds)
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .where(_wherePk(childTable.primaryKeys, rowId)),
            null,
            { raw: true },
          );

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
            updatedColIds: [column.id],
          });

          // Broadcast child row update (FK was updated on this row)
          baseModel.dbDriver.attachToTransaction(async () => {
            await childBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId], linkColIds);
          });

          // Broadcast parent row update (link count changed on the referenced record)
          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates(childIds as string[], linkColIds);
          });
        }
        break;
    }

    const parentAuditObj = [];
    const childAuditObj = [];

    for (const childId of childIds) {
      const _childId =
        typeof childId === 'object'
          ? childBaseModel.extractPksValues(childId, true)
          : childId;

      parentAuditObj.push({
        rowId,
        refRowId: _childId,
        displayValue: row[column.title] ?? row[column.column_name],
        type: colOptions.type as RelationTypes,
      });

      if (parentTable.id !== childTable.id) {
        childAuditObj.push({
          rowId: _childId,
          refRowId: rowId,
          refDisplayValue:
            dataWrapper(row).getByColumnNameTitleOrId(childColumn),
          type: getOppositeRelationType(colOptions.type),
        });
      }
    }

    baseModel.dbDriver.attachToTransaction(async () => {
      const baseModelClone = baseModel.getNonTransactionalClone();
      await baseModelClone.afterAddOrRemoveChild(
        {
          opType: AuditV1OperationTypes.DATA_LINK,
          model: auditConfig.parentModel,
          refModel: auditConfig.childModel,
          columnTitle: auditConfig.parentColTitle,
          columnId: auditConfig.parentColId,
          refColumnTitle: auditConfig.childColTitle,
          refColumnId: auditConfig.childColId,
          req: cookie,
        },
        parentAuditObj,
      );
      await baseModelClone.afterAddOrRemoveChild(
        {
          opType: AuditV1OperationTypes.DATA_LINK,
          model: auditConfig.childModel,
          refModel: auditConfig.parentModel,
          columnTitle: auditConfig.childColTitle,
          columnId: auditConfig.childColId,
          refColumnTitle: auditConfig.parentColTitle,
          refColumnId: auditConfig.parentColId,
          req: cookie,
        },
        childAuditObj,
      );
    });

    fireLinkHooks?.();
  };

  const removeLinks = async ({
    cookie,
    childIds: _childIds,
    colId,
    rowId,
    triggerUpdateHooks = false,
  }: {
    cookie: any;
    childIds: (string | number)[];
    colId: string;
    rowId: string;
    // Fire after-update hooks for the linked records — user-facing link calls only
    triggerUpdateHooks?: boolean;
  }) => {
    await baseModel.model.getColumns();
    const column = baseModel.model.columnsById[colId];

    if (!column || !isLinksOrLTAR(column))
      NcError.get(baseModel.context).fieldNotFound(colId);

    const row = await baseModel.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    // validate rowId
    if (!row) {
      NcError.get(baseModel.context).recordNotFound(rowId);
    }

    if (!_childIds.length) return;

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const { parentContext, childContext, mmContext } =
      await colOptions.getParentChildContext();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    // The related table and its columns are loaded already, so the mirror lookup reuses them
    const linkColIds = touchedLinkColumnIds(
      column.id,
      (
        await extractCorrespondingLinkColumn(baseModel.context, {
          ltarColumn: column,
          referencedTable: [parentTable, childTable].find(
            (table) => table.id === colOptions.fk_related_model_id,
          ),
        })
      )?.id,
    );

    const childBaseModel = await Model.getBaseModelSQL(childContext, {
      model: childTable,
      dbDriver: baseModel.dbDriver,
    });

    const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
      model: parentTable,
      dbDriver: baseModel.dbDriver,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    // v2 link-records body sends `[{Id: x}, ...]`; normalize to primitive PKs once
    // so downstream audit + broadcast paths don't stringify objects as '[object Object]'.
    const childIds = _childIds.map((id) =>
      id !== null && typeof id === 'object'
        ? childBaseModel.extractPksValues(id, true)
        : id,
    );

    const relatedChildCol = getRelatedLinksColumn(
      column,
      baseModel.model.id === parentTable.id ? childTable : parentTable,
    );

    const _auditUpdateObj = [] as {
      columnTitle: string;
      columnId: string;
      refColumnTitle?: string;
      rowId: unknown;
      refRowId: unknown;
      req: NcRequest;
      model: Model;
      refModel?: Model;
      displayValue?: unknown;
      refDisplayValue?: unknown;
      opSubType:
        | AuditOperationSubTypes.LINK_RECORD
        | AuditOperationSubTypes.UNLINK_RECORD;
      type: RelationTypes;
    }[];

    const auditConfig = {
      childModel: childTable,
      parentModel: parentTable,
      childColTitle: relatedChildCol?.title || '',
      parentColTitle: column.title,
      childColId: relatedChildCol?.id || '',
      parentColId: column.id,
    } as {
      childModel: Model;
      parentModel: Model;
      childColTitle: string;
      childColId: string;
      parentColTitle: string;
      parentColId: string;
    };

    const fireLinkHooks = triggerUpdateHooks
      ? await captureLinkHookRowsForColumn({
          baseModel,
          column,
          rowId,
          refRowIds: childIds,
          linkedRefRowIds: [],
          req: cookie,
        })
      : null;

    const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;

    switch (relationType) {
      case RelationTypes.MANY_TO_MANY:
        {
          validateRefIds(childIds, parentTable);
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: vTable,
            dbDriver: baseModel.dbDriver,
          });
          const refBaseModel = parentBaseModel;

          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(parentTn)
              .select(parentColumn.column_name);

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else if (typeof childIds[0] === 'object') {
              childRowsQb.whereIn(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
                childIds.map((c) =>
                  dataWrapper(c).getByColumnNameTitleOrId(
                    parentTable.primaryKey,
                  ),
                ),
              );
            } else {
              childRowsQb.whereIn(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
                childIds,
              );
            }

            if (parentTable.primaryKey.column_name !== parentColumn.column_name)
              childRowsQb.select(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
              );

            const childRows = await refBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                raw: true,
              },
            );

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find(
                    (r) =>
                      r[parentColumn.column_name] ===
                      (typeof id === 'object'
                        ? dataWrapper(id).getByColumnNameTitleOrId(
                            parentTable.primaryKey,
                          )
                        : id),
                  ),
              );

              NcError.get(baseModel.context).recordNotFound(
                extractIds(missingIds),
              );
            }
          }

          const vTn = assocBaseModel.getTnPath(vTable);

          const delQb = baseModel
            .dbDriver(vTn)
            .where({
              [vChildCol.column_name]: baseModel
                .dbDriver(childTn)
                .select(childColumn.column_name)
                .where(_wherePk(childTable.primaryKeys, rowId))
                .first(),
            })
            .delete();

          delQb.whereIn(
            `${vTable.table_name}.${vParentCol.column_name}`,
            typeof childIds[0] === 'object'
              ? childIds.map((c) =>
                  dataWrapper(c).getByColumnNameTitleOrId(
                    parentTable.primaryKey,
                  ),
                )
              : childIds,
          );
          await refBaseModel.execAndParse(delQb, null, { raw: true });

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: childIds,
            cookie,
            updatedColIds: [
              (
                await extractCorrespondingLinkColumn(baseModel.context, {
                  ltarColumn: column,
                  referencedTable: childTable,
                  referencedTableColumns: childTable.columns,
                })
              )?.id,
            ],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates(childIds as string[], linkColIds);
          });

          await childBaseModel.updateLastModified({
            model: childTable,
            rowIds: [rowId],
            cookie,
            updatedColIds: [column.id],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await childBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId], linkColIds);
          });

          auditConfig.parentModel =
            baseModel.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            baseModel.model.id === parentTable.id ? childTable : parentTable;
          if (baseModel.model.id !== parentTable.id) {
            auditConfig.parentColTitle = relatedChildCol?.title || '';
            auditConfig.parentColId = relatedChildCol?.id || '';
            auditConfig.childColTitle = column.title;
            auditConfig.childColId = column.id;
          }
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          validateRefIds(childIds, childTable);
          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(childTn)
              .select(childTable.primaryKey.column_name);

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else if (typeof childIds[0] === 'object') {
              childRowsQb.whereIn(
                parentTable.primaryKey.column_name,
                childIds.map((c) =>
                  dataWrapper(c).getByColumnNameTitleOrId(
                    parentTable.primaryKey,
                  ),
                ),
              );
            } else {
              childRowsQb.whereIn(parentTable.primaryKey.column_name, childIds);
            }

            const childRows = await childBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                raw: true,
              },
            );

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find(
                    (r) =>
                      r[parentColumn.column_name] ===
                      (typeof id === 'object'
                        ? dataWrapper(id).getByColumnNameTitleOrId(
                            parentTable.primaryKey,
                          )
                        : id),
                  ),
              );

              NcError.get(baseModel.context).recordNotFound(
                extractIds(missingIds),
              );
            }
          }

          // only unlink children that point at this row; others are a no-op
          const childRowsQb = baseModel
            .dbDriver(childTn)
            .where(
              childColumn.column_name,
              dataWrapper(row).getByColumnNameTitleOrId(parentColumn),
            );

          if (parentTable.primaryKeys.length > 1) {
            childRowsQb.where((qb) => {
              for (const childId of childIds) {
                qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
              }
            });
          } else {
            childRowsQb.whereIn(
              parentTable.primaryKey.column_name,
              typeof childIds[0] === 'object'
                ? childIds.map((c) =>
                    dataWrapper(c).getByColumnNameTitleOrId(
                      parentTable.primaryKey,
                    ),
                  )
                : childIds,
            );
          }

          await childBaseModel.execAndParse(
            childRowsQb.update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
            updatedColIds: [column.id],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId], linkColIds);
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          validateRefIds(childIds, parentTable);
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;
          auditConfig.parentColTitle = relatedChildCol?.title || '';
          auditConfig.parentColId = relatedChildCol?.id || '';
          auditConfig.childColTitle = column.title;
          auditConfig.childColId = column.id;

          const refBaseModel = parentBaseModel;
          if (childIds.length > 1)
            NcError.get(baseModel.context).unprocessableEntity(
              'Request must contain only one parent id',
            );

          const parentRow = await refBaseModel.execAndParse(
            baseModel
              .dbDriver(parentTn)
              .select(parentColumn.column_name)
              .where(_wherePk(parentTable.primaryKeys, childIds[0]))
              .first(),
            null,
            {
              first: true,
              raw: true,
            },
          );

          if (!parentRow) {
            NcError.get(baseModel.context).recordNotFound(
              extractIds(childIds, true),
            );
          }

          // only clear the FK if it points at the given parent; a different target is a no-op
          await refBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              .where(childTable.primaryKey.column_name, rowId)
              .where(
                childColumn.column_name,
                parentRow[parentColumn.column_name],
              )
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [childIds[0]],
            cookie,
            updatedColIds: [
              (
                await extractCorrespondingLinkColumn(baseModel.context, {
                  ltarColumn: column,
                  referencedTable: childTable,
                })
              )?.id,
            ],
          });

          // Broadcast child row update (FK was cleared on this row)
          baseModel.dbDriver.attachToTransaction(async () => {
            await childBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId], linkColIds);
          });

          // Broadcast parent row update (link count changed on the unlinked record)
          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([childIds[0] as string], linkColIds);
          });
        }
        break;
    }

    const parentAuditObj = [];
    const childAuditObj = [];

    for (const childId of childIds) {
      const _childId =
        typeof childId === 'object'
          ? childBaseModel.extractPksValues(childId, true)
          : childId;

      parentAuditObj.push({
        rowId,
        refRowId: _childId,
        displayValue: dataWrapper(row).getByColumnNameTitleOrId(column),
        type: colOptions.type as RelationTypes,
      });

      if (parentTable.id !== childTable.id) {
        childAuditObj.push({
          rowId: _childId,
          refRowId: rowId,
          refDisplayValue:
            dataWrapper(row).getByColumnNameTitleOrId(childColumn),
          type: getOppositeRelationType(colOptions.type),
        });
      }
    }

    baseModel.dbDriver.attachToTransaction(async () => {
      await parentBaseModel.getNonTransactionalClone().afterAddOrRemoveChild(
        {
          opType: AuditV1OperationTypes.DATA_UNLINK,
          model: auditConfig.parentModel,
          refModel: auditConfig.childModel,
          columnTitle: auditConfig.parentColTitle,
          columnId: auditConfig.parentColId,
          refColumnTitle: auditConfig.childColTitle,
          refColumnId: auditConfig.childColId,
          req: cookie,
        },
        parentAuditObj,
      );
      await childBaseModel.getNonTransactionalClone().afterAddOrRemoveChild(
        {
          opType: AuditV1OperationTypes.DATA_UNLINK,
          model: auditConfig.childModel,
          refModel: auditConfig.parentModel,
          columnTitle: auditConfig.childColTitle,
          columnId: auditConfig.childColId,
          refColumnTitle: auditConfig.parentColTitle,
          refColumnId: auditConfig.parentColId,
          req: cookie,
        },
        childAuditObj,
      );
    });

    fireLinkHooks?.();
  };
  // Move an existing link `childId` within `rowId`'s ordered list of links for
  // column `colId`, placing it immediately before `before` (another linked
  // record's id) or at the end when `before` is null. Only the current side's
  // order is changed — the junction Order column grouped by vChildCol, matching
  // the read fallback in mmList / the mm lookup path. v2 junctions only.
  const reorderLink = async ({
    colId,
    rowId,
    childId,
    before,
    cookie,
  }: {
    cookie?: any;
    colId: string;
    rowId: string | number;
    childId: string | number;
    before?: string | number | null;
  }) => {
    const context = baseModel.context;

    const column = (await baseModel.model.getColumns()).find(
      (c) => c.id === colId,
    );
    if (!column || !isLinksOrLTAR(column)) {
      NcError.get(context).unprocessableEntity(
        `Link column not found: ${colId}`,
      );
    }
    const colOptions =
      (await column.getColOptions()) as LinkToAnotherRecordColumn;

    // Ordering lives on the junction Order column — only present for v2
    // junction-based links on NocoDB-managed sources. Its absence gates out
    // hm/bt, v1 links, and external junctions with a clear error.
    const { mmContext } = colOptions.getRelContext();
    const orderCol = await colOptions.getMMChildOrderColumn();
    if (!orderCol) {
      NcError.get(context).unprocessableEntity(
        'This link does not support ordering',
      );
    }

    const vChildCol = await colOptions.getMMChildColumn();
    const vParentCol = await colOptions.getMMParentColumn();
    const vTable = await colOptions.getMMModel();
    const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
      model: vTable,
      dbDriver: baseModel.dbDriver,
    });
    const vTn = assocBaseModel.getTnPath(vTable);

    // mm child/parent columns reference the related PKs, so rowId/childId ARE
    // the junction FK values.
    const partitionQb = () =>
      baseModel.dbDriver(vTn).where(vChildCol.column_name, rowId);

    // Reassign 1..n by current order within this partition (gap-recovery).
    const reindexPartition = async () => {
      const rows = await baseModel
        .dbDriver(vTn)
        .select(vParentCol.column_name)
        .where(vChildCol.column_name, rowId)
        .orderBy(orderCol.column_name, 'asc');
      let i = 1;
      for (const r of rows) {
        await baseModel
          .dbDriver(vTn)
          .where(vChildCol.column_name, rowId)
          .where(vParentCol.column_name, r[vParentCol.column_name])
          .update({ [orderCol.column_name]: i++ });
      }
    };

    let newOrder: BigNumber;
    if (before === undefined || before === null || before === '') {
      const maxRes = await partitionQb()
        .max(`${orderCol.column_name} as m`)
        .first();
      newOrder = new BigNumber(maxRes?.m ?? 0).plus(1);
    } else {
      const beforeRow = await partitionQb()
        .where(vParentCol.column_name, before)
        .first();
      if (!beforeRow) {
        NcError.get(context).recordNotFound(`${before}`);
      }
      const beforeOrder = new BigNumber(beforeRow[orderCol.column_name] ?? 0);
      const prevRes = await partitionQb()
        .where(orderCol.column_name, '<', beforeOrder.toString())
        .max(`${orderCol.column_name} as m`)
        .first();
      const prevOrder = new BigNumber(prevRes?.m ?? 0);
      newOrder = prevOrder.plus(beforeOrder.minus(prevOrder).div(2));
      // Fractional gap exhausted → reindex the partition to integers and retry
      // once (consecutive integers always leave room for a midpoint).
      if (newOrder.lte(prevOrder) || newOrder.gte(beforeOrder)) {
        await reindexPartition();
        return reorderLink({ colId, rowId, childId, before, cookie });
      }
    }

    await partitionQb()
      .where(vParentCol.column_name, childId)
      .update({ [orderCol.column_name]: newOrder.toString() });

    // Realtime: bump the current record's modified time and broadcast the link
    // update so the grid canvas (and other clients) re-read the reordered cell —
    // same as addLinks/removeLinks. Ordering is partitioned by the current
    // record's junction FK, so only `rowId` needs to refresh.
    await baseModel.updateLastModified({
      model: baseModel.model,
      rowIds: [rowId],
      cookie,
      updatedColIds: [column.id],
    });
    baseModel.dbDriver.attachToTransaction(async () => {
      await baseModel
        .getNonTransactionalClone()
        .broadcastLinkUpdates([String(rowId)], [column.id]);
    });

    return true;
  };

  return {
    addLinks,
    removeLinks,
    reorderLink,
    extractCorrespondingLinkColumn,
  };
};
