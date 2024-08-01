import type { ColumnGroupType } from 'ant-design-vue/es/table'

export const tableColumns:  NcTableColumnProps[] = [
  {
    title: 'Column Name',
    name: 'Column Name',
    dataIndex: 'column_name',
    key: 'column_name',
    minWidth: 200,
    padding: '0px 12px',
  },
  {
    title: 'Column Type',
    name: 'Column Type',
    dataIndex: 'column_type',
    key: 'uidt',
    minWidth: 200,
    padding: '0px 12px',
  },
  // {
  //   name: 'Select Option',
  //   key: 'dtxp',
  // },
  {
    title: '',
    name: 'Action',
    key: 'action',
    width: 60,
    minWidth: 58,
    padding: '0px 12px',
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
