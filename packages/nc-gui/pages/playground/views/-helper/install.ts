import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { createMockAdapter } from './mock-api'
import type { MockDb, UnmockedRequest } from './mock-api'
import { MOCK_BASE_ID, MOCK_TASKS_TABLE_ID, MOCK_USERS, buildRows, buildTable, buildTasksTable, mockBase } from './mock-data'
import type { MockViewKind } from './mock-data'

type Adapter = AxiosInstance['defaults']['adapter']

interface Session {
  kind: MockViewKind
  db: MockDb
  seeded: boolean
}

interface Saved {
  instance: Adapter
  global: Adapter
  user: unknown
  lastVisitedBase: string | null
  recentViews: unknown[] | null
}

const VIEW_ROUTE = /^\/playground\/views\/(grid|gallery|kanban|calendar|form)(\/|$)/

let saved: Saved | null = null

let session: Session | null = null

let guardRegistered = false

export const unmockedRequests = shallowRef<UnmockedRequest[]>([])

export const getMockSession = () => session

if (typeof window !== 'undefined') {
  // console handle for debugging the mocks: __ncPlaygroundMocks.unmockedRequests.value
  ;(window as unknown as Record<string, unknown>).__ncPlaygroundMocks = { unmockedRequests, getMockSession }
}

function recordUnmocked(req: UnmockedRequest) {
  if (unmockedRequests.value.some((u) => u.method === req.method && u.url === req.url && u.operation === req.operation)) return
  unmockedRequests.value = [req, ...unmockedRequests.value].slice(0, 50)
}

function seedStores(kind: MockViewKind, db: MockDb) {
  const table = db.tables[kind]!
  const tasksTable = db.tables[MOCK_TASKS_TABLE_ID]!

  const { metas } = useMetas()
  metas.value = {
    ...metas.value,
    [`${MOCK_BASE_ID}:${table.id}`]: table,
    [`${MOCK_BASE_ID}:${MOCK_TASKS_TABLE_ID}`]: tasksTable,
  }

  const basesStore = useBases()
  basesStore.bases.set(MOCK_BASE_ID, mockBase() as NcProject)
  basesStore.basesUser.set(MOCK_BASE_ID, MOCK_USERS.map((u) => ({ ...u, roles: 'editor' })) as unknown as User[])

  useTablesStore().baseTables.set(MOCK_BASE_ID, [table, tasksTable] as SidebarTableNode[])

  useViewsStore().viewsByTable.set(`${MOCK_BASE_ID}:${table.id}`, table.views ?? [])
}

function uninstall(api: { instance: AxiosInstance }, user: Ref<any>) {
  if (!saved) return
  api.instance.defaults.adapter = saved.instance
  axios.defaults.adapter = saved.global
  user.value = saved.user
  if (saved.recentViews) {
    const viewsStore = useViewsStore()
    viewsStore.allRecentViews = saved.recentViews as typeof viewsStore.allRecentViews
  }
  try {
    if (saved.lastVisitedBase) localStorage.setItem('ncLastVisitedBase', saved.lastVisitedBase)
    else localStorage.removeItem('ncLastVisitedBase')
  } catch {}
  saved = null
  session = null
}

/**
 * Called from the view page's route middleware — i.e. before the route
 * commits — because store watchers react to `route.params.baseId/viewId`
 * immediately and would otherwise hit the real backend for base `views`.
 * Only touches the adapter + user here: stores can't be created outside a
 * component setup (several call useI18n). Torn down by a router guard once
 * navigation leaves the view pages.
 */
export function installPlaygroundMocks(kind: MockViewKind) {
  const nuxtApp = useNuxtApp()
  const api = nuxtApp.$api as unknown as { instance: AxiosInstance }
  const { user } = useGlobal()

  if (!saved) {
    saved = {
      instance: api.instance.defaults.adapter,
      global: axios.defaults.adapter,
      user: user.value,
      lastVisitedBase: localStorage.getItem('ncLastVisitedBase'),
      recentViews: null,
    }
  }

  if (session?.kind !== kind) {
    const table = buildTable(kind)
    const tasksTable = buildTasksTable()
    const db: MockDb = {
      tables: { [table.id!]: table, [tasksTable.id!]: tasksTable },
      views: Object.fromEntries((table.views ?? []).map((v) => [v.id!, v])),
      rows: buildRows(),
      user: { ...(saved.user as object), base_roles: { owner: true } },
    }
    session = { kind, db, seeded: false }
    unmockedRequests.value = []

    const adapter = createMockAdapter(db, recordUnmocked, axios.getAdapter(saved.global ?? axios.defaults.adapter))
    // useApi() creates fresh axios instances that copy axios.defaults at
    // creation, so patch the global defaults as well as the shared $api.
    api.instance.defaults.adapter = adapter
    axios.defaults.adapter = adapter
  }

  user.value = { ...(saved.user as object), base_roles: { owner: true } } as typeof user.value

  if (!guardRegistered) {
    guardRegistered = true
    nuxtApp.$router.afterEach((to) => {
      if (!VIEW_ROUTE.test(to.path)) uninstall(api, user)
    })
  }
}

/** Seeds metas/bases/tables/views for the session — call from component setup. */
export function seedPlaygroundStores() {
  if (!session || session.seeded) return
  // Creation order matters on a direct load: the credits store reads
  // useBases() in a computed when the route has a baseId but no workspace, so
  // it must exist before the bases store's setup pulls it in.
  useWorkspace()
  useCredits()
  const viewsStore = useViewsStore()
  if (saved && !saved.recentViews) saved.recentViews = [...viewsStore.allRecentViews]
  seedStores(session.kind, session.db)
  session.seeded = true
}
