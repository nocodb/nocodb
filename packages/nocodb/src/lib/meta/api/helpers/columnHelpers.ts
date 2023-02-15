import {
  ColumnReqType,
  LinkToAnotherRecordType,
  LookupColumnReqType,
  RelationTypes,
  RollupColumnReqType,
  UITypes,
} from 'nocodb-sdk';
import Column from '../../../models/Column';
import LinkToAnotherRecordColumn from '../../../models/LinkToAnotherRecordColumn';
import LookupColumn from '../../../models/LookupColumn';
import Model from '../../../models/Model';
import { getUniqueColumnAliasName } from '../../helpers/getUniqueName';
import validateParams from '../../helpers/validateParams';

export async function createHmAndBtColumn(
  child: Model,
  parent: Model,
  childColumn: Column,
  type?: RelationTypes,
  alias?: string,
  virtual = false,
  isSystemCol = false
) {
  // save bt column
  {
    const title = getUniqueColumnAliasName(
      await child.getColumns(),
      type === 'bt' ? alias : `${parent.title}`
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
      system: isSystemCol,
    });
  }
  // save hm column
  {
    const title = getUniqueColumnAliasName(
      await parent.getColumns(),
      type === 'hm' ? alias : `${child.title} List`
    );
    await Column.insert({
      title,
      fk_model_id: parent.id,
      uidt: UITypes.LinkToAnotherRecord,
      type: 'hm',
      fk_child_column_id: childColumn.id,
      fk_parent_column_id: parent.primaryKey.id,
      fk_related_model_id: child.id,
      virtual,
      system: isSystemCol,
    });
  }
}

export async function validateRollupPayload(
  payload: ColumnReqType & { uidt: UITypes }
) {
  validateParams(
    [
      'title',
      'fk_relation_column_id',
      'fk_rollup_column_id',
      'rollup_function',
    ],
    payload
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
      (c) => c.id === (payload as RollupColumnReqType).fk_rollup_column_id
    )
  )
    throw new Error('Rollup column not found in related table');
}

export async function validateLookupPayload(
  payload: ColumnReqType & { uidt: UITypes },
  columnId?: string
) {
  validateParams(
    ['title', 'fk_relation_column_id', 'fk_lookup_column_id'],
    payload
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
        }
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
      (c) => c.id === (payload as LookupColumnReqType).fk_lookup_column_id
    )
  )
    throw new Error('Lookup column not found in related table');
}

export const validateRequiredField = (
  payload: Record<string, any>,
  requiredProps: string[]
) => {
  return requiredProps.every(
    (prop) =>
      prop in payload && payload[prop] !== undefined && payload[prop] !== null
  );
};
