import { defaultColumns } from './columns'

export const MOCK_TABLES_RAW = [
  {
    id: 'mtWA9ZXvsuh',
    name: 'table1',
    columns: defaultColumns,
  },
  {
    id: 'mehpRLA42Cz',
    name: 'table2',
  },
]

export const mockSetupInit = async () => {
  const { metas } = useMetas()
  for (const table of MOCK_TABLES_RAW) {
    metas.value[table.id] = table
  }
}
