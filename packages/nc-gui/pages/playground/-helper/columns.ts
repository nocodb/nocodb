import { type ColumnType, UITypes } from 'nocodb-sdk'

const defaultColumnModelId = 'mtWA9ZXvsuh'
const table2ColumnModelId = 'mehpRLA42Cz'
let defaultColumnOrder = 1
export const defaultColumns: ColumnType[] = [
  {
    id: 'col-slt',
    uidt: UITypes.SingleLineText,
    title: 'SingleLineText',
    dt: 'text',
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
  },
  {
    id: 'col-decimal',
    uidt: UITypes.Decimal,
    title: 'Decimal',
    dt: 'decimal',
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
  },
  {
    id: 'col-number',
    uidt: UITypes.Number,
    title: 'Number',
    dt: 'bigint',
    dtx: 'specificType',
    meta: { isLocaleString: false },
    system: false,
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
  },
  {
    id: 'col-links',
    uidt: UITypes.Links,
    title: 'Links HM',
    colOptions: {
      type: 'hm',
      fk_related_model_id: table2ColumnModelId,
    },
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
  },
  {
    id: 'col-datetime',
    uidt: UITypes.DateTime,
    meta: {
      dateFormat: 'YY/MM/DD',
    },
    title: 'DateTime',
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
  },
  {
    id: 'col-date-monthonly',
    uidt: UITypes.Date,
    meta: {
      dateFormat: 'YY-MM',
    },
    title: 'Date',
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
  },
  {
    id: 'col-date-monthonly',
    uidt: UITypes.Date,
    meta: {
      dateFormat: 'YY-MM',
    },
    title: 'Date (monthonly)',
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
  },
  {
    id: 'col-checkbox',
    uidt: UITypes.Checkbox,
    title: 'Checkbox',
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
  },
  {
    id: 'col-lookup',
    uidt: UITypes.Lookup,
    title: 'Lookup',
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
    colOptions: {
      fk_column_id: 'col-lookup',
      fk_relation_column_id: 'col-links',
      fk_lookup_column_id: 'col2-slt',
      fk_related_model_id: table2ColumnModelId,
    },
  },
  {
    id: 'col-lookup-decimal',
    uidt: UITypes.Lookup,
    title: 'Lookup (Decimal)',
    fk_model_id: defaultColumnModelId,
    order: defaultColumnOrder++,
    colOptions: {
      fk_column_id: 'col-lookup',
      fk_relation_column_id: 'col-links',
      fk_lookup_column_id: 'col2-decimal',
      fk_related_model_id: table2ColumnModelId,
    },
  },
]

let table2ColumnOrder = 1
export const table2Columns: ColumnType[] = [
  {
    id: 'col2-slt',
    uidt: UITypes.SingleLineText,
    title: 'SingleLineText',
    dt: 'text',
    fk_model_id: table2ColumnModelId,
    order: table2ColumnOrder++,
  },
  {
    id: 'col2-decimal',
    uidt: UITypes.Decimal,
    title: 'Decimal',
    dt: 'decimal',
    fk_model_id: table2ColumnModelId,
    order: table2ColumnOrder++,
  },
]
