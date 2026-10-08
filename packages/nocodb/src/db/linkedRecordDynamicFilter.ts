import {
  isLinksOrLTAR,
  isMMOrMMLike,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { FilterOperationResult } from '~/db/field-handler/field-handler.interface';
import type {
  Column,
  Filter,
  LinkToAnotherRecordColumn,
  LookupColumn,
} from '~/models';
import { Model } from '~/models';
import { _wherePk, getAliasedSoftDeleteFilter } from '~/helpers/dbHelpers';

const MAX_LOOKUP_DEPTH = 10;

export const LINKED_RECORD_DYNAMIC_OPS = ['eq', 'neq'];

export function isLinkedRecordColumn(column: Column) {
  return isLinksOrLTAR(column) || column?.uidt === UITypes.Lookup;
}

/**
 * Relation hops from a Link column, or a Lookup chain ending in a Link column,
 * to the linked records. Returns null for any other column.
 */
async function getRelationPath(
  column: Column,
  depth = 0,
): Promise<Column[] | null> {
  if (!column || depth > MAX_LOOKUP_DEPTH) return null;

  if (isLinksOrLTAR(column)) return [column];

  if (column.uidt !== UITypes.Lookup) return null;

  const colOptions = await column.getColOptions<LookupColumn>();
  if (!colOptions || colOptions.error) return null;

  const relationColumn = await colOptions.getRelationColumn();
  const lookupColumn = await colOptions.getLookupColumn();
  if (!relationColumn || !lookupColumn) return null;

  const rest = await getRelationPath(lookupColumn, depth + 1);
  return rest ? [relationColumn, ...rest] : null;
}

/**
 * Builds `SELECT <linked record pk> FROM <start table> JOIN ...` following the
 * relation path; `restrict` pins the start table alias to specific row(s).
 */
async function buildLinkedRecordIdsQuery({
  knex,
  baseModel,
  path,
  aliasCount,
  restrict,
}: {
  knex: Knex;
  baseModel: IBaseModelSqlV2;
  path: Column[];
  aliasCount: { count: number };
  restrict: (qb: Knex.QueryBuilder, alias: string) => void;
}): Promise<{ qb: Knex.QueryBuilder; targetPkRef: string } | null> {
  let currentAlias = `__nc_lr${aliasCount.count++}`;
  const qb = knex(
    baseModel.getTnPath(baseModel.model.table_name, currentAlias),
  );
  restrict(qb, currentAlias);

  let targetModel: Model;

  for (const relationColumn of path) {
    const colOptions =
      await relationColumn.getColOptions<LinkToAnotherRecordColumn>();
    if (!colOptions) return null;

    const { parentContext, childContext, mmContext } =
      await colOptions.getParentChildContext(relationColumn);

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    if (!childColumn || !parentColumn) return null;

    let relationType = isMMOrMMLike(relationColumn)
      ? RelationTypes.MANY_TO_MANY
      : colOptions.type;
    if (relationType === RelationTypes.ONE_TO_ONE) {
      relationType = relationColumn.meta?.bt
        ? RelationTypes.BELONGS_TO
        : RelationTypes.HAS_MANY;
    }

    const nextAlias = `__nc_lr${aliasCount.count++}`;
    const prevAlias = currentAlias;

    if (relationType === RelationTypes.HAS_MANY) {
      targetModel = await childColumn.getModel();
      const childBaseModel = await Model.getBaseModelSQL(childContext, {
        model: targetModel,
        dbDriver: baseModel.dbDriver,
      });
      qb.join(
        childBaseModel.getTnPath(targetModel.table_name, nextAlias),
        `${nextAlias}.${childColumn.column_name}`,
        `${prevAlias}.${parentColumn.column_name}`,
      );
      const softDeleteFilter = await getAliasedSoftDeleteFilter(
        childBaseModel,
        nextAlias,
      );
      if (softDeleteFilter) qb.where(softDeleteFilter);
    } else if (relationType === RelationTypes.BELONGS_TO) {
      targetModel = await parentColumn.getModel();
      const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
        model: targetModel,
        dbDriver: baseModel.dbDriver,
      });
      qb.join(
        parentBaseModel.getTnPath(targetModel.table_name, nextAlias),
        `${nextAlias}.${parentColumn.column_name}`,
        `${prevAlias}.${childColumn.column_name}`,
      );
      const softDeleteFilter = await getAliasedSoftDeleteFilter(
        parentBaseModel,
        nextAlias,
      );
      if (softDeleteFilter) qb.where(softDeleteFilter);
    } else if (relationType === RelationTypes.MANY_TO_MANY) {
      const mmModel = await colOptions.getMMModel();
      const mmChildColumn = await colOptions.getMMChildColumn();
      const mmParentColumn = await colOptions.getMMParentColumn();
      if (!mmModel || !mmChildColumn || !mmParentColumn) return null;

      targetModel = await parentColumn.getModel();
      const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
        model: mmModel,
        dbDriver: baseModel.dbDriver,
      });
      const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
        model: targetModel,
        dbDriver: baseModel.dbDriver,
      });
      const mmAlias = `__nc_lr${aliasCount.count++}`;
      qb.join(
        mmBaseModel.getTnPath(mmModel.table_name, mmAlias),
        `${mmAlias}.${mmChildColumn.column_name}`,
        `${prevAlias}.${childColumn.column_name}`,
      ).join(
        parentBaseModel.getTnPath(targetModel.table_name, nextAlias),
        `${nextAlias}.${parentColumn.column_name}`,
        `${mmAlias}.${mmParentColumn.column_name}`,
      );
      const softDeleteFilter = await getAliasedSoftDeleteFilter(
        parentBaseModel,
        nextAlias,
      );
      if (softDeleteFilter) qb.where(softDeleteFilter);
    } else {
      return null;
    }

    currentAlias = nextAlias;
  }

  if (!targetModel) return null;
  await targetModel.getColumns();
  if (targetModel.primaryKeys?.length !== 1) return null;

  return {
    qb,
    targetPkRef: `${currentAlias}.${targetModel.primaryKey.column_name}`,
  };
}

/**
 * Unsaved source row: start from the records its first link points at
 * (`rowData[<link title>]`, pk + display value only) and follow the rest.
 */
async function buildUnsavedRowIdsQuery(
  context: NcContext,
  knex: Knex,
  baseModelSqlv2: IBaseModelSqlV2,
  valuePath: Column[],
  rowData: Record<string, any>,
  aliasCount: { count: number },
): Promise<{ qb: Knex.QueryBuilder; targetPkRef: string } | null> {
  const [firstHop, ...rest] = valuePath;
  const colOptions = await firstHop.getColOptions<LinkToAnotherRecordColumn>();
  const firstModel = await colOptions?.getRelatedTable();
  if (!firstModel) return null;
  await firstModel.getColumns();
  if (firstModel.primaryKeys?.length !== 1) return null;

  const firstBaseModel = await Model.getBaseModelSQL(
    { ...context, base_id: firstModel.base_id },
    { model: firstModel, dbDriver: baseModelSqlv2.dbDriver },
  );
  const pk = firstModel.primaryKey;
  const linked = ([] as any[]).concat(rowData?.[firstHop.title] ?? []);
  const ids = linked
    .map((r) => r?.[pk.title] ?? r?.[pk.column_name])
    .filter((id) => id !== undefined && id !== null);

  if (!rest.length) {
    const alias = `__nc_lr${aliasCount.count++}`;
    return {
      qb: knex(firstBaseModel.getTnPath(firstModel.table_name, alias)).whereIn(
        `${alias}.${pk.column_name}`,
        ids,
      ),
      targetPkRef: `${alias}.${pk.column_name}`,
    };
  }

  return buildLinkedRecordIdsQuery({
    knex,
    baseModel: firstBaseModel,
    path: rest,
    aliasCount,
    restrict: (qb, rowAlias) => {
      qb.whereIn(`${rowAlias}.${pk.column_name}`, ids);
    },
  });
}

/**
 * Dynamic filter where both sides are a Link field or a Lookup of a Link field:
 * matches when the record being filtered and the source row
 * (`filter._crossTableRowId`, or `_crossTableRowData` when it is unsaved) link
 * to at least one common record (`eq`), or to
 * none (`neq`). Records are matched by primary key, not display value.
 */
export async function resolveLinkedRecordDynamicFilter(
  context: NcContext,
  knex: Knex,
  filter: Filter,
  filterColumn: Column,
  valueColumn: Column,
  alias: string | undefined,
  baseModelSqlv2: IBaseModelSqlV2,
  aliasCount: { count: number },
): Promise<false | FilterOperationResult> {
  const rowId = filter._crossTableRowId;
  const rowData = filter._crossTableRowData;
  if (
    (!rowId && !rowData) ||
    !LINKED_RECORD_DYNAMIC_OPS.includes(filter.comparison_op)
  ) {
    return false;
  }

  const filterPath = await getRelationPath(filterColumn);
  const valuePath = await getRelationPath(valueColumn);
  if (!filterPath || !valuePath) return false;

  // Both sides must point at the same table to compare records.
  const filterTarget = await filterPath[filterPath.length - 1]
    .getColOptions<LinkToAnotherRecordColumn>()
    .then((o) => o?.fk_related_model_id);
  const valueTarget = await valuePath[valuePath.length - 1]
    .getColOptions<LinkToAnotherRecordColumn>()
    .then((o) => o?.fk_related_model_id);
  if (!filterTarget || filterTarget !== valueTarget) return false;

  const filterModel = baseModelSqlv2.model;
  const valueModel = await valueColumn.getModel();
  await filterModel.getColumns();
  await valueModel.getColumns();
  if (!filterModel.primaryKeys?.length || !valueModel.primaryKeys?.length) {
    return false;
  }

  const valueIds = rowId
    ? await buildLinkedRecordIdsQuery({
        knex,
        baseModel: await Model.getBaseModelSQL(context, {
          model: valueModel,
          dbDriver: baseModelSqlv2.dbDriver,
        }),
        path: valuePath,
        aliasCount,
        restrict: (qb, rowAlias) => {
          const pkWhere = _wherePk(valueModel.primaryKeys, rowId);
          if (typeof pkWhere === 'function') {
            qb.where(pkWhere);
          } else {
            for (const [col, val] of Object.entries(pkWhere)) {
              qb.where(`${rowAlias}.${col}`, val);
            }
          }
        },
      })
    : await buildUnsavedRowIdsQuery(
        context,
        knex,
        baseModelSqlv2,
        valuePath,
        rowData,
        aliasCount,
      );

  const sourceAlias = alias || baseModelSqlv2.getTnPath(filterModel.table_name);

  const filterIds = await buildLinkedRecordIdsQuery({
    knex,
    baseModel: baseModelSqlv2,
    path: filterPath,
    aliasCount,
    restrict: (qb, rowAlias) => {
      for (const pk of filterModel.primaryKeys) {
        qb.whereRaw('??.?? = ??.??', [
          rowAlias,
          pk.column_name,
          sourceAlias,
          pk.column_name,
        ]);
      }
    },
  });

  if (!valueIds || !filterIds) return false;

  valueIds.qb.select(valueIds.targetPkRef);
  const existsQb = filterIds.qb
    .select(knex.raw('1'))
    .whereIn(filterIds.targetPkRef, valueIds.qb);

  return {
    clause: (qb: Knex.QueryBuilder) => {
      if (filter.comparison_op === 'neq') qb.whereNotExists(existsQb);
      else qb.whereExists(existsQb);
    },
    rootApply: undefined,
  };
}
