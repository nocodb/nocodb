import { getI18n } from '~/plugins/a.i18n'

export const tableColumns: NcTableColumnProps[] = [
  {
    get title() {
      return getI18n().global.t('general.enabled')
    },
    key: 'enabled',
    padding: '0px 0px 0px 12px',
    minWidth: 0,
    width: 33,
  },
  {
    get title() {
      return getI18n().global.t('labels.syncSchemaColName')
    },
    name: 'Column Name',
    dataIndex: 'column_name',
    key: 'column_name',
    minWidth: 200,
    padding: '0px 12px 0 9px',
  },
]

export const srcDestMappingColumns: NcTableColumnProps[] = [
  {
    get title() {
      return getI18n().global.t('objects.field')
    },
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
