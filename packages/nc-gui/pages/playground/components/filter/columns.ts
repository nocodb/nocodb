import { type ColumnType, UITypes } from 'nocodb-sdk'

export const defaultColumns: ColumnType[] = [
  {
    id: 'col1',
    uidt: UITypes.SingleLineText,
    title: 'Column 1',
    dt: 'text',
    order: 1,
  },
  {
    id: 'col2',
    uidt: UITypes.Decimal,
    title: 'Column 2',
    dt: 'decimal',
    order: 2,
  },
  {
    id: 'col3',
    uidt: UITypes.Number,
    title: 'Column 3',
    dt: 'bigint',
    dtx: 'specificType',
    meta: { isLocaleString: false },
    system: false,
    order: 5,
  },
  {
    id: 'col4',
    uidt: UITypes.Links,
    title: 'Column 4',
    order: 3,
  },
  {
    id: 'col5',
    uidt: UITypes.DateTime,
    meta: {
      dateFormat: 'YY/MM/DD',
    },
    title: 'Column 5',
    order: 4,
  },
  {
    id: 'col-date-monthonly',
    uidt: UITypes.Date,
    meta: {
      dateFormat: 'YY-MM',
    },
    title: 'Column 6',
    order: 6,
  },
]
