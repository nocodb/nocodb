import { defaultBases } from './bases'
import { defaultColumns, table2Columns } from './columns'
import { defaultViews } from './views'

const defaultBaseId = 'pRdVnZXPZgA'

// MockInjection reads view columns in public-view mode: the meta columns double as view columns, keyed by
// fk_column_id, and only the ones marked `show` are offered in field pickers
const shown = <T extends { id?: string }>(columns: T[]) => columns.map((c) => ({ ...c, fk_column_id: c.id, show: true }))
export const MOCK_TABLES_RAW = [
  {
    id: 'mtWA9ZXvsuh',
    name: 'table1',
    source_id: 'bmpgnvh49n8i51l',
    columns: shown(defaultColumns),
    base_id: defaultBaseId,
  },
  {
    id: 'mehpRLA42Cz',
    name: 'table2',
    source_id: 'bmpgnvh49n8i51l',
    columns: shown(table2Columns),
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

// the signed-in user and active base that mockSetupInit swaps out, put back by mockSetupRestore
let saved: { user: ReturnType<typeof useGlobalState>['user']['value']; forcedProjectId?: string } | null = null

export const mockSetupInit = () => {
  const { metas } = useMetas()
  for (const table of MOCK_TABLES_RAW) {
    const compositeKey = `${table.base_id}:${table.id}`
    metas.value[compositeKey] = table
  }
  const basesStore = useBases()
  for (const baseId of Object.keys(defaultBases)) {
    basesStore.bases.set(baseId, defaultBases[baseId])
  }

  const baseStore = useBase()
  const globalState = useGlobalState()
  saved ??= { user: globalState.user.value, forcedProjectId: baseStore.forcedProjectId }

  baseStore.forcedProjectId = defaultBaseId
  globalState.user.value = mockUsers[0]

  return {
    metas,
    meta: metas.value[`${defaultBaseId}:mtWA9ZXvsuh`],
    rootMetaId: 'mtWA9ZXvsuh',
    bases: basesStore.bases,
    baseId: baseStore.forcedProjectId,
    views: defaultViews,
    view: defaultViews[0],
    user: mockUsers[0],
  }
}

export const mockSetupRestore = () => {
  if (!saved) return
  const { metas } = useMetas()
  for (const table of MOCK_TABLES_RAW) delete metas.value[`${table.base_id}:${table.id}`]
  const basesStore = useBases()
  for (const baseId of Object.keys(defaultBases)) basesStore.bases.delete(baseId)
  useBase().forcedProjectId = saved.forcedProjectId
  useGlobalState().user.value = saved.user
  saved = null
}
