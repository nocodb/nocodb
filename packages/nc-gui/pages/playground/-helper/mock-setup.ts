import { defaultBases } from './bases'
import { defaultColumns, table2Columns } from './columns'
import { defaultViews } from './views'

const defaultBaseId = 'pRdVnZXPZgA'
export const MOCK_TABLES_RAW = [
  {
    id: 'mtWA9ZXvsuh',
    name: 'table1',
    source_id: 'bmpgnvh49n8i51l',
    columns: defaultColumns,
    base_id: defaultBaseId,
  },
  {
    id: 'mehpRLA42Cz',
    name: 'table2',
    source_id: 'bmpgnvh49n8i51l',
    columns: table2Columns,
    base_id: defaultBaseId,
  },
  {
    id: 'm0WRAn0wWu3',
    name: 'table3',
    base_id: 'pRdVnZXPZgA',
  },
]

const mockUsers = [
  {
    id: 'usyrewj87j5pd2i4',
    email: 'test@example.com',
    display_name: null,
    invite_token: null,
    main_roles: 'org-level-creator,super',
    meta: null,
    created_at: '2025-04-21 06:57:38+00:00',
    updated_at: '2025-04-21 06:57:38+00:00',
    base_id: defaultBaseId,
    roles: 'owner',
    workspace_roles: 'workspace-level-owner',
    workspace_id: 'wv4stxso',
    deleted: false,
  },
]

export const mockSetupInit = () => {
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

  const globalState = useGlobalState()
  globalState.user.value = mockUsers[0]

  return {
    metas,
    meta: metas.value.mtWA9ZXvsuh,
    rootMetaId: 'mtWA9ZXvsuh',
    bases: basesStore.bases,
    baseId: baseStore.forcedProjectId,
    views: defaultViews,
    view: defaultViews[0],
    user: mockUsers[0],
  }
}
