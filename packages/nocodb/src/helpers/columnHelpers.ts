import { customAlphabet } from 'nanoid';
import { UITypes } from 'nocodb-sdk';
import { pluralize, singularize } from 'inflection';
import type { RollupColumn } from '~/models';
import type {
  BoolType,
  ColumnReqType,
  LinkToAnotherRecordType,
  LookupColumnReqType,
  RelationTypes,
  RollupColumnReqType,
  TableType,
} from 'nocodb-sdk';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type LookupColumn from '~/models/LookupColumn';
import type Model from '~/models/Model';
import validateParams from '~/helpers/validateParams';
import { getUniqueColumnAliasName } from '~/helpers/getUniqueName';
import Column from '~/models/Column';
import { GridViewColumn } from '~/models';

export const randomID = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz_',
  10,
);

export async function createHmAndBtColumn(
  child: Model,
  parent: Model,
  childColumn: Column,
  type?: RelationTypes,
  alias?: string,
  fkColName?: string,
  virtual: BoolType = false,
  isSystemCol = false,
  columnMeta = null,
  isLinks = false,
) {
  // save bt column
  {
    const title = getUniqueColumnAliasName(
      await child.getColumns(),
      (type === 'bt' && alias) || `${parent.title}`,
    );
    await Column.insert<LinkToAnotherRecordColumn>({
      title,

      fk_model_id: child.id,
      // ref_db_alias
      uidt: UITypes.LinkToAnotherRecord,
      type: 'bt',
      // db_type:

      fk_child_column_id: childColumn.id,
      fk_parent_column_id: parent.primaryKey.id,
      fk_related_model_id: parent.id,
      virtual,
      // if self referencing treat it as system field to hide from ui
      system: isSystemCol || parent.id === child.id,
      fk_col_name: fkColName,
      fk_index_name: fkColName,
    });
  }
  // save hm column
  {
    const title = getUniqueColumnAliasName(
      await parent.getColumns(),
      (type === 'hm' && alias) || pluralize(child.title),
    );
    const meta = {
      plural: columnMeta?.plural || pluralize(child.title),
      singular: columnMeta?.singular || singularize(child.title),
    };

    await Column.insert({
      title,
      fk_model_id: parent.id,
      uidt: isLinks ? UITypes.Links : UITypes.LinkToAnotherRecord,
      type: 'hm',
      fk_child_column_id: childColumn.id,
      fk_parent_column_id: parent.primaryKey.id,
      fk_related_model_id: child.id,
      virtual,
      system: isSystemCol,
      fk_col_name: fkColName,
      fk_index_name: fkColName,
      meta,
    });
  }
}

export async function validateRollupPayload(payload: ColumnReqType | Column) {
  validateParams(
    [
      'title',
      'fk_relation_column_id',
      'fk_rollup_column_id',
      'rollup_function',
    ],
    payload,
  );

  const relation = await (
    await Column.get({
      colId: (payload as RollupColumnReqType).fk_relation_column_id,
    })
  ).getColOptions<LinkToAnotherRecordType>();

  if (!relation) {
    throw new Error('Relation column not found');
  }

  let relatedColumn: Column;
  switch (relation.type) {
    case 'hm':
      relatedColumn = await Column.get({
        colId: relation.fk_child_column_id,
      });
      break;
    case 'mm':
    case 'bt':
      relatedColumn = await Column.get({
        colId: relation.fk_parent_column_id,
      });
      break;
  }

  const relatedTable = await relatedColumn.getModel();
  if (
    !(await relatedTable.getColumns()).find(
      (c) => c.id === (payload as RollupColumnReqType).fk_rollup_column_id,
    )
  )
    throw new Error('Rollup column not found in related table');
}

export async function validateLookupPayload(
  payload: ColumnReqType,
  columnId?: string,
) {
  validateParams(
    ['title', 'fk_relation_column_id', 'fk_lookup_column_id'],
    payload,
  );

  // check for circular reference
  if (columnId) {
    let lkCol: LookupColumn | LookupColumnReqType =
      payload as LookupColumnReqType;
    while (lkCol) {
      // check if lookup column is same as column itself
      if (columnId === lkCol.fk_lookup_column_id)
        throw new Error('Circular lookup reference not allowed');
      lkCol = await Column.get({ colId: lkCol.fk_lookup_column_id }).then(
        (c: Column) => {
          if (c.uidt === 'Lookup') {
            return c.getColOptions<LookupColumn>();
          }
          return null;
        },
      );
    }
  }

  const relation = await (
    await Column.get({
      colId: (payload as LookupColumnReqType).fk_relation_column_id,
    })
  ).getColOptions<LinkToAnotherRecordType>();

  if (!relation) {
    throw new Error('Relation column not found');
  }

  let relatedColumn: Column;
  switch (relation.type) {
    case 'hm':
      relatedColumn = await Column.get({
        colId: relation.fk_child_column_id,
      });
      break;
    case 'mm':
    case 'bt':
      relatedColumn = await Column.get({
        colId: relation.fk_parent_column_id,
      });
      break;
  }

  const relatedTable = await relatedColumn.getModel();
  if (
    !(await relatedTable.getColumns()).find(
      (c) => c.id === (payload as LookupColumnReqType).fk_lookup_column_id,
    )
  )
    throw new Error('Lookup column not found in related table');
}

export const validateRequiredField = (
  payload: Record<string, any>,
  requiredProps: string[],
) => {
  return requiredProps.every(
    (prop) =>
      prop in payload && payload[prop] !== undefined && payload[prop] !== null,
  );
};

// generate unique foreign key constraint name for foreign key
export const generateFkName = (parent: TableType, child: TableType) => {
  // generate a unique constraint name by taking first 10 chars of parent and child table name (by replacing all non word chars with _)
  // and appending a random string of 15 chars maximum length.
  // In database constraint name can be upto 64 chars and here we are generating a name of maximum 40 chars
  const constraintName = `fk_${parent.table_name
    .replace(/\W+/g, '_')
    .slice(0, 10)}_${child.table_name
    .replace(/\W+/g, '_')
    .slice(0, 10)}_${randomID()}`;
  return constraintName;
};

export async function populateRollupForLTAR({
  column,
  columnMeta,
  alias,
}: {
  column: Column;
  columnMeta?: any;
  alias?: string;
}) {
  const model = await column.getModel();

  const views = await model.getViews();

  const relatedModel = await column
    .getColOptions<LinkToAnotherRecordColumn>()
    .then((colOpt) => colOpt.getRelatedTable());
  await relatedModel.getColumns();
  const pkId =
    relatedModel.primaryKey?.id || (await relatedModel.getColumns())[0]?.id;

  const meta = {
    plural: columnMeta?.plural || pluralize(relatedModel.title),
    singular: columnMeta?.singular || singularize(relatedModel.title),
  };

  await Column.insert<RollupColumn>({
    uidt: UITypes.Links,
    title: getUniqueColumnAliasName(
      await model.getColumns(),
      alias || `${relatedModel.title} Count`,
    ),
    fk_rollup_column_id: pkId,
    fk_model_id: model.id,
    rollup_function: 'count',
    fk_relation_column_id: column.id,
    meta,
  });

  const viewCol = await GridViewColumn.list(views[0].id).then((cols) =>
    cols.find((c) => c.fk_column_id === column.id),
  );
  await GridViewColumn.update(viewCol.id, { show: false });
}

export const sanitizeColumnName = (name: string) => {
  const columnName = name.replace(/\W+/g, '_').trim();

  // if column name only contains _ then return as 'field'
  if (/^_+$/.test(columnName)) return 'field';

  return columnName;
};
