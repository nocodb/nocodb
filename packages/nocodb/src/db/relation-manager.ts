import { NcError } from 'src/helpers/catchError';
import { RelationTypes, UITypes } from 'nocodb-sdk';
import { Model } from 'src/models';
import type { Column, LinkToAnotherRecordColumn } from 'src/models';
import type { IBaseModelSqlV2 } from './IBaseModelSqlV2';
import type { Knex } from 'knex';

export function _wherePk(
  primaryKeys: Column[],
  id: unknown | unknown[],
  skipPkValidation = false,
) {
  const where = {};

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

export class RelationManager {
  constructor(
    private relationContext: {
      baseModel: IBaseModelSqlV2;
      childTn: string | Knex.Raw<any>;
      childColumn: Column<any>;
      childTable: Model;
      childBaseModel: IBaseModelSqlV2;
      parentTn: string | Knex.Raw<any>;
      parentColumn: Column<any>;
      parentTable: Model;
      parentBaseModel: IBaseModelSqlV2;
      childId: any;
      parentId: any;
    },
  ) {}

  getRelationContext() {
    return this.relationContext;
  }

  static async getRelationManager(
    baseModel: IBaseModelSqlV2,
    colId: string,
    id: {
      rowId: any;
      childId: any;
    },
  ) {
    await baseModel.model.getColumns(baseModel.context);
    const column = baseModel.model.columnsById[colId];

    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.fieldNotFound(colId);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      baseModel.context,
    );
    const isBt =
      colOptions.type === RelationTypes.BELONGS_TO || column.meta?.bt;

    const childColumn = await colOptions.getChildColumn(baseModel.context);
    const parentColumn = await colOptions.getParentColumn(baseModel.context);
    const parentTable = await parentColumn.getModel(baseModel.context);
    const childTable = await childColumn.getModel(baseModel.context);
    await childTable.getColumns(baseModel.context);
    await parentTable.getColumns(baseModel.context);

    const parentBaseModel = await Model.getBaseModelSQL(baseModel.context, {
      model: parentTable,
      dbDriver: baseModel.dbDriver,
    });

    const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
      dbDriver: baseModel.dbDriver,
      model: childTable,
    });

    return new RelationManager({
      baseModel,
      childTn: childBaseModel.getTnPath(childTable),
      childColumn,
      childTable,
      childBaseModel,
      parentTn: parentBaseModel.getTnPath(parentTable),
      parentColumn,
      parentTable,
      parentBaseModel,
      childId:
        isBt || colOptions.type === RelationTypes.MANY_TO_MANY
          ? id.rowId
          : id.childId,
      parentId:
        isBt || colOptions.type === RelationTypes.MANY_TO_MANY
          ? id.childId
          : id.rowId,
    });
  }

  async getHmOrOChildRow() {
    const { baseModel, childTn, childColumn, childTable, childId } =
      this.relationContext;
    return await baseModel.execAndParse(
      baseModel
        .dbDriver(childTn)
        .select(
          ...new Set(
            [childColumn, ...childTable.primaryKeys].map(
              (col) => `${childTable.table_name}.${col.column_name}`,
            ),
          ),
        )
        .where(_wherePk(childTable.primaryKeys, childId)),
      null,
      { raw: true, first: true },
    );
  }

  async getHmOrOoChildLinkedWithParent() {
    const {
      baseModel,
      childTn,
      parentTn,
      childColumn,
      parentColumn,
      parentTable,
      parentId,
    } = this.relationContext;
    return await baseModel.execAndParse(
      baseModel.dbDriver(childTn).where({
        [childColumn.column_name]: baseModel.dbDriver.from(
          baseModel
            .dbDriver(parentTn)
            .select(parentColumn.column_name)
            .where(_wherePk(parentTable.primaryKeys, parentId))
            .first()
            .as('___cn_alias'),
        ),
      }),
      null,
      { raw: true, first: true },
    );
  }
}
