export const tableColumns: NcTableColumnProps[] = [
  {
    title: 'Enabled',
    key: 'enabled',
    padding: '0px 0px 0px 12px',
    minWidth: 0,
    width: 64,
  },
  {
    title: 'Column Name',
    name: 'Column Name',
    dataIndex: 'column_name',
    key: 'column_name',
    minWidth: 200,
    padding: '0px 12px',
  },
]

export const srcDestMappingColumns: NcTableColumnProps[] = [
  {
    title: 'Field',
    dataIndex: 'source_column',
    key: 'source_column',
    minWidth: 200,
    padding: '0px 0px 0px 12px',
  },
  {
    title: 'NocoDB Field',
    dataIndex: 'destination_column',
    key: 'destination_column',
    minWidth: 200,
    padding: '0px 12px 0px 0px',
  },
]
