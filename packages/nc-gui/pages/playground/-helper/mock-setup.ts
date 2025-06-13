import { defaultBases } from './bases'
import { defaultColumns, table2Columns } from './columns'

const defaultBaseId = 'pRdVnZXPZgA'
export const MOCK_TABLES_RAW = [
  {
    id: 'mtWA9ZXvsuh',
    name: 'table1',
    columns: defaultColumns,
    base_id: defaultBaseId,
  },
  {
    id: 'mehpRLA42Cz',
    name: 'table2',
    columns: table2Columns,
    base_id: defaultBaseId,
  },
  {
    id: 'm0WRAn0wWu3',
    name: 'table3',
    base_id: 'pRdVnZXPZgA',
  },
]

export const mockSetupInit = async () => {
  const { metas } = useMetas()
  for (const table of MOCK_TABLES_RAW) {
    metas.value[table.id] = table
  }
  const basesStore = useBases()
  for (const baseId of Object.keys(defaultBases)) {
    basesStore.bases.set(baseId, defaultBases[baseId])
  }

  const baseStore = useBase()
  baseStore.forcedProjectId = defaultBaseId
}
