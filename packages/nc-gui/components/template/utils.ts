import type { ColumnGroupType } from 'ant-design-vue/es/table'

export const tableColumns: (Omit<ColumnGroupType<any>, 'children'> & { dataIndex?: string; name: string })[] = [
  {
    name: 'Column Name',
    dataIndex: 'column_name',
    key: 'column_name',
    width: 250,
  },
  {
    name: 'Column Type',
    dataIndex: 'column_type',
    key: 'uidt',
    width: 250,
  },
  {
    name: 'Select Option',
    key: 'dtxp',
  },
  {
    name: 'Action',
    key: 'action',
    align: 'right',
  },
]

export const srcDestMappingColumns: (Omit<ColumnGroupType<any>, 'children'> & { dataIndex?: string; name: string })[] = [
  {
    name: 'Source column',
    dataIndex: 'source_column',
    key: 'source_column',
    width: 400,
  },
  {
    name: 'Destination column',
    dataIndex: 'destination_column',
    key: 'destination_column',
    width: 400,
  },
  {
    name: 'Action',
    key: 'action',
    align: 'center',
    width: 50,
  },
]
