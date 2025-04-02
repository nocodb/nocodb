import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isOrderCol,
  isSystemColumn,
  isVirtualCol,
  NcApiVersion,
  type NcContext,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
import type {
  XcFilter,
  XcFilterWithAlias,
} from '~/db/sql-data-mapper/lib/BaseModel';
import type { SortType } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from 'knex';
import type { Filter, GridViewColumn } from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  Column,
  type LinkToAnotherRecordColumn,
  Model,
  Sort,
  Source,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import { excludeAttachmentProps } from '~/utils';

export function concatKnexRaw(knex: CustomKnex, raws: Knex.Raw[]) {
  return knex.raw(raws.map(() => '?').join(' '), raws);
}

export function _wherePk(
  primaryKeys: Column[],
  id: unknown | unknown[],
  skipPkValidation = false,
) {
  const where: Record<string, unknown> = {};

  // if id object is provided use as it is
  if (id && typeof id === 'object' && !Array.isArray(id)) {
    // verify all pk columns are present in id object
    for (const pk of primaryKeys) {
      let key: string;
      if (pk.id in id) {
        key = pk.id;
      } else if (pk.title in id) {
        key = pk.title;
      } else if (pk.column_name in id) {
        key = pk.column_name;
      } else {
        NcError.badRequest(
          `Primary key column ${pk.title} not found in id object`,
        );
      }
      where[pk.column_name] = id[key];
      // validate value if auto-increment column
      // todo: add more validation based on column constraints
      if (!skipPkValidation && pk.ai && !/^\d+$/.test(id[key])) {
        NcError.invalidPrimaryKey(id[key], pk.title);
      }
    }

    return where;
  }

  let ids = id;

  if (Array.isArray(id)) {
    ids = id;
  } else if (primaryKeys.length === 1) {
    ids = [id];
  } else {
    ids = (id + '').split('___').map((val) => val.replaceAll('\\_', '_'));
  }

  for (let i = 0; i < primaryKeys.length; ++i) {
    if (primaryKeys[i].dt === 'bytea') {
      // if column is bytea, then we need to encode the id to hex based on format
      // where[primaryKeys[i].column_name] =
      // (primaryKeys[i].meta?.format === 'hex' ? '\\x' : '') + ids[i];
      return (qb) => {
        qb.whereRaw(
          `?? = decode(?, '${
            primaryKeys[i].meta?.format === 'hex' ? 'hex' : 'escape'
          }')`,
          [primaryKeys[i].column_name, ids[i]],
        );
      };
    }

    // Cast the id to string.
    const idAsString = ids[i] + '';
    // Check if the id is a UUID and the column is binary(16)
    const isUUIDBinary16 =
      primaryKeys[i].ct === 'binary(16)' &&
      (idAsString.length === 36 || idAsString.length === 32);
    // If the id is a UUID and the column is binary(16), convert the id to a Buffer. Otherwise, return null to indicate that the id is not a UUID.
    const idAsUUID = isUUIDBinary16
      ? idAsString.length === 32
        ? idAsString.replace(
            /(.{8})(.{4})(.{4})(.{4})(.{12})/,
            '$1-$2-$3-$4-$5',
          )
        : idAsString
      : null;

    where[primaryKeys[i].column_name] = idAsUUID
      ? Buffer.from(idAsUUID.replace(/-/g, ''), 'hex')
      : ids[i];
  }
  return where;
}

export function getCompositePkValue(primaryKeys: Column[], row) {
  if (row === null || row === undefined) {
    NcError.requiredFieldMissing(primaryKeys.map((c) => c.title).join(','));
  }

  if (typeof row !== 'object') return row;

  if (primaryKeys.length > 1) {
    return primaryKeys
      .map((c) =>
        (row[c.title] ?? row[c.column_name])
          ?.toString?.()
          .replaceAll('_', '\\_'),
      )
      .join('___');
  }

  return (
    primaryKeys[0] &&
    (row[primaryKeys[0].title] ?? row[primaryKeys[0].column_name])
  );
}

export function getOppositeRelationType(
  type: RelationTypes | LinkToAnotherRecordColumn['type'],
) {
  if (type === RelationTypes.HAS_MANY) {
    return RelationTypes.BELONGS_TO;
  } else if (type === RelationTypes.BELONGS_TO) {
    return RelationTypes.HAS_MANY;
  }
  return type as RelationTypes;
}

export async function getBaseModelSqlFromModelId({
  modelId,
  context,
}: {
  context: NcContext;
  modelId: string;
}) {
  const model = await Model.get(context, modelId);
  const source = await Source.get(context, model.source_id);
  return await Model.getBaseModelSQL(context, {
    id: model.id,
    dbDriver: await NcConnectionMgrv2.get(source),
    source,
  });
}

// Audit logging is enabled by default unless explicitly disabled using NC_DISABLE_AUDIT=true
export function isDataAuditEnabled() {
  return process.env.NC_DISABLE_AUDIT !== 'true';
}

export function getRelatedLinksColumn(
  column: Column<LinkToAnotherRecordColumn>,
  relatedModel: Model,
) {
  return relatedModel.columns.find((c: Column) => {
    if (column.colOptions?.type === RelationTypes.MANY_TO_MANY) {
      return (
        column.colOptions.fk_mm_child_column_id ===
          c.colOptions?.fk_mm_parent_column_id &&
        column.colOptions.fk_mm_parent_column_id ===
          c.colOptions?.fk_mm_child_column_id
      );
    } else {
      return (
        column.colOptions.fk_child_column_id ===
          c.colOptions?.fk_child_column_id &&
        column.colOptions.fk_parent_column_id ===
          c.colOptions?.fk_parent_column_id
      );
    }
  });
}

export function extractIdPropIfObjectOrReturn(id: any, prop: string) {
  return typeof id === 'object' ? id[prop] : id;
}
export const nanoidv2 = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  14,
);

export async function populatePk(
  context: NcContext,
  model: Model,
  insertObj: any,
) {
  await model.getColumns(context);
  for (const pkCol of model.primaryKeys) {
    if (!pkCol.meta?.ag || insertObj[pkCol.title]) continue;
    insertObj[pkCol.title] =
      pkCol.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
  }
}

export function checkColumnRequired(
  column: Column<any>,
  fields: string[],
  extractPkAndPv?: boolean,
) {
  // if primary key or foreign key included in fields, it's required
  if (column.pk || column.uidt === UITypes.ForeignKey) return true;

  if (extractPkAndPv && column.pv) return true;

  // check fields defined and if not, then select all
  // if defined check if it is in the fields
  return !fields || fields.includes(column.title);
}

export async function getColumnName(
  context: NcContext,
  column: Column<any>,
  columns?: Column[],
) {
  if (
    !isCreatedOrLastModifiedTimeCol(column) &&
    !isCreatedOrLastModifiedByCol(column) &&
    !isOrderCol(column)
  )
    return column.column_name;
  columns =
    columns ||
    (await Column.list(context, { fk_model_id: column.fk_model_id }));

  switch (column.uidt) {
    case UITypes.CreatedTime: {
      const createdTimeSystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.CreatedTime,
      );
      if (createdTimeSystemCol) return createdTimeSystemCol.column_name;
      return column.column_name || 'created_at';
    }
    case UITypes.LastModifiedTime: {
      const lastModifiedTimeSystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.LastModifiedTime,
      );
      if (lastModifiedTimeSystemCol)
        return lastModifiedTimeSystemCol.column_name;
      return column.column_name || 'updated_at';
    }
    case UITypes.CreatedBy: {
      const createdBySystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.CreatedBy,
      );
      if (createdBySystemCol) return createdBySystemCol.column_name;
      return column.column_name || 'created_by';
    }
    case UITypes.LastModifiedBy: {
      const lastModifiedBySystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.LastModifiedBy,
      );
      if (lastModifiedBySystemCol) return lastModifiedBySystemCol.column_name;
      return column.column_name || 'updated_by';
    }
    case UITypes.Order: {
      const orderSystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.Order,
      );
      if (orderSystemCol) return orderSystemCol.column_name;
      return column.column_name || 'nc_order';
    }
    default:
      return column.column_name;
  }
}

export function getAs(column: Column) {
  return column.asId || column.id;
}

export function replaceDynamicFieldWithValue(
  _row: any,
  _rowId,
  _tableColumns: Column[],
  _readByPk: typeof BaseModelSqlv2.prototype.readByPk,
  _queryParams?: Record<string, string>,
) {
  const replaceWithValue = async (conditions: Filter[]) => {
    return conditions;
  };
  return replaceWithValue;
}

export const isPrimitiveType = (val) =>
  typeof val === 'string' || typeof val === 'number';

export function transformObject(value, idToAliasMap) {
  const result = {};
  Object.entries(value).forEach(([k, v]) => {
    const btAlias = idToAliasMap[k];
    if (btAlias) {
      result[btAlias] = v;
    }
  });
  return result;
}

export function extractSortsObject(
  _sorts: string | string[],
  aliasColObjMap: { [columnAlias: string]: Column },
  throwErrorIfInvalid = false,
): Sort[] {
  if (!_sorts?.length) return;

  let sorts = _sorts;
  if (!Array.isArray(sorts)) sorts = sorts.split(/\s*,\s*/);

  return sorts.map((s) => {
    const sort: SortType = { direction: 'asc' };
    if (s.startsWith('-')) {
      sort.direction = 'desc';
      sort.fk_column_id = aliasColObjMap[s.slice(1)]?.id;
    } else if (s.startsWith('~-')) {
      sort.direction = 'count-desc';
      sort.fk_column_id = aliasColObjMap[s.slice(2)]?.id;
    } else if (s.startsWith('~+')) {
      sort.direction = 'count-asc';
      sort.fk_column_id = aliasColObjMap[s.slice(2)]?.id;
    }
    // replace + at the beginning if present
    else {
      sort.fk_column_id = aliasColObjMap[s.replace(/^\+/, '')]?.id;
    }

    if (throwErrorIfInvalid && !sort.fk_column_id)
      NcError.fieldNotFound(s.replace(/^~?[+-]/, ''));
    return new Sort(sort);
  });
}

export function applyPaginate(
  query,
  {
    limit = 25,
    offset = 0,
    ignoreLimit = false,
  }: XcFilter & { ignoreLimit?: boolean },
) {
  query.offset(offset);
  if (!ignoreLimit) query.limit(limit);
  return query;
}

export function haveFormulaColumn(columns: Column[]) {
  return columns.some((c) => c.uidt === UITypes.Formula);
}

export function shouldSkipField(
  fieldsSet,
  viewOrTableColumn,
  view,
  column,
  extractPkAndPv,
) {
  if (fieldsSet) {
    return !fieldsSet.has(column.title);
  } else {
    if (column.system && isCreatedOrLastModifiedByCol(column)) return true;
    if (column.system && isOrderCol(column)) return true;
    if (!extractPkAndPv) {
      if (!(viewOrTableColumn instanceof Column)) {
        if (
          !(viewOrTableColumn as GridViewColumn)?.show &&
          !(column.rqd && !column.cdf && !column.ai) &&
          !column.pk &&
          column.uidt !== UITypes.ForeignKey
        )
          return true;
        if (
          !view?.show_system_fields &&
          column.uidt !== UITypes.ForeignKey &&
          !column.pk &&
          isSystemColumn(column)
        )
          return true;
      }
    }
    return false;
  }
}

export function getListArgs(
  args: XcFilterWithAlias,
  model: Model,
  {
    ignoreAssigningWildcardSelect = false,
    apiVersion = NcApiVersion.V2,
    nested = false,
  } = {},
): XcFilter {
  const obj: XcFilter = {};
  obj.where = args.where || args.filter || args.w || '';
  obj.having = args.having || args.h || '';
  obj.shuffle = args.shuffle || args.r || '';
  obj.condition = args.condition || args.c || {};
  obj.conditionGraph = args.conditionGraph || {};
  obj.page = args.page || args.p;
  if (apiVersion === NcApiVersion.V3 && nested) {
    if (obj.nestedLimit) {
      obj.limit = obj.limit = Math.max(
        Math.min(
          Math.max(+obj.nestedLimit, 0) || defaultLimitConfig.limitDefault,
          defaultLimitConfig.limitMax,
        ),
        defaultLimitConfig.limitMin,
      );
    } else {
      obj.limit = defaultLimitConfig.ltarV3Limit;
    }
  } else {
    obj.limit = Math.max(
      Math.min(
        Math.max(+(args?.limit || args?.l), 0) ||
          defaultLimitConfig.limitDefault,
        defaultLimitConfig.limitMax,
      ),
      defaultLimitConfig.limitMin,
    );
  }
  obj.offset = Math.max(+(args?.offset || args?.o) || 0, 0);
  if (obj.page) {
    obj.offset = (+obj.page - 1) * +obj.limit;
  }
  obj.fields =
    args?.fields || args?.f || (ignoreAssigningWildcardSelect ? null : '*');
  obj.sort = args?.sort || args?.s || model.primaryKey?.[0]?.column_name;
  obj.pks = args?.pks;
  obj.aggregation = args.aggregation || [];
  obj.column_name = args.column_name;
  return obj;
}

export function extractIds(
  childIds: (string | number | Record<string, any>)[],
  isBt = false,
) {
  return (isBt ? childIds.slice(0, 1) : childIds).map((r) =>
    typeof r === 'object' ? JSON.stringify(r) : `${r}`,
  );
}

export function formatDataForAudit(
  data: Record<string, unknown>,
  columns: Column[],
) {
  if (!data || typeof data !== 'object') return data;
  const res = {};

  for (const column of columns) {
    if (isSystemColumn(column) || isVirtualCol(column)) continue;

    if (!(column.title in data)) {
      continue;
    }

    res[column.title] = data[column.title];

    // if multi-select column, convert string to array
    if (column.uidt === UITypes.MultiSelect) {
      if (res[column.title] && typeof res[column.title] === 'string') {
        res[column.title] = (res[column.title] as string).split(',');
      }
    }
    // if attachment then exclude signed url and thumbnail
    else if (column.uidt === UITypes.Attachment) {
      if (res[column.title] && Array.isArray(res[column.title])) {
        try {
          res[column.title] = (res[column.title] as any[]).map((attachment) =>
            excludeAttachmentProps(attachment),
          );
        } catch {
          // ignore
        }
      }
    }
  }

  return res;
}
