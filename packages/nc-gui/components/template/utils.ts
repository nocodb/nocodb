export const tableColumns: NcTableColumnProps[] = [
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
    minWidth: 60,
    padding: '0px 12px',
  },
]

export const srcDestMappingColumns: NcTableColumnProps[] = [
  {
    title: 'Source column',
    dataIndex: 'source_column',
    key: 'source_column',
    minWidth: 200,
    padding: '0px 12px',
  },
  {
    title: 'Destination column',
    dataIndex: 'destination_column',
    key: 'destination_column',
    minWidth: 200,
    padding: '0px 12px',
  },
  {
    title: 'Action',
    key: 'action',
    justify: 'justify-center',
    width: 60,
    minWidth: 60,
    padding: '0px 12px',
  },
]
