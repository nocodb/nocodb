import { defaultBases } from './bases'
import { defaultColumns } from './columns'

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
