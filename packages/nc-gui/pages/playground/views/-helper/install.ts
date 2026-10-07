import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { HttpClient } from 'nocodb-sdk'
import { createMockAdapter } from './mock-api'
import type { MockDb, UnmockedRequest } from './mock-api'
import {
  MOCK_BASE_ID,
  MOCK_TASKS_TABLE_ID,
  MOCK_USERS,
  buildComments,
  buildRows,
  buildTable,
  buildTasksTable,
  mockBase,
} from './mock-data'
import type { MockViewKind } from './mock-data'

type MergeParams = (this: HttpClient, params1: AxiosRequestConfig, params2?: AxiosRequestConfig) => AxiosRequestConfig

interface Session {
  kind: MockViewKind
  db: MockDb
  seeded: boolean
}

interface Saved {
  mergeRequestParams: MergeParams
  user: unknown
  lastVisitedBase: string | null
  recentViews: unknown[] | null
  interceptorId: number | null
}

// surfaces/* pages reuse the grid session
const VIEW_ROUTE = /^\/playground\/(views\/(grid|gallery|kanban|calendar|form|map|list|timeline|gantt|expanded)|surfaces)(\/|$)/

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
  // the signed-in user too, so comments posted here get a name and avatar
  const me = { id: db.user.id, email: db.user.email, display_name: db.user.display_name, roles: 'owner' }
  basesStore.basesUser.set(MOCK_BASE_ID, [...MOCK_USERS.map((u) => ({ ...u, roles: 'editor' })), me] as unknown as User[])

  useTablesStore().baseTables.set(MOCK_BASE_ID, [table, tasksTable] as SidebarTableNode[])

  useViewsStore().viewsByTable.set(`${MOCK_BASE_ID}:${table.id}`, table.views ?? [])
}

function uninstall(user: Ref<any>, api: ReturnType<typeof useNuxtApp>['$api']) {
  if (!saved) return
  HttpClient.prototype.mergeRequestParams = saved.mergeRequestParams
  if (saved.interceptorId !== null) api.instance.interceptors.request.eject(saved.interceptorId)
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
  const { user } = useGlobal()

  if (!saved) {
    saved = {
      mergeRequestParams: HttpClient.prototype.mergeRequestParams,
      user: user.value,
      lastVisitedBase: localStorage.getItem('ncLastVisitedBase'),
      recentViews: null,
      interceptorId: null,
    }
  }

  if (session?.kind !== kind) {
    const table = buildTable(kind)
    const tasksTable = buildTasksTable()
    const db: MockDb = {
      tables: { [table.id!]: table, [tasksTable.id!]: tasksTable },
      views: Object.fromEntries((table.views ?? []).map((v) => [v.id!, v])),
      rows: buildRows(),
      comments: buildComments(table.id!),
      user: { ...(saved.user as object), base_roles: { owner: true } },
    }
    session = { kind, db, seeded: false }
    unmockedRequests.value = []

    const adapter = createMockAdapter(db, recordUnmocked, axios.getAdapter(axios.defaults.adapter))
    // Stores build their Api clients at boot, and Vite can pre-bundle a second axios copy for the SDK,
    // so neither instance defaults nor our `axios` import reach them. Every SDK call builds its config here.
    const merge = saved.mergeRequestParams
    HttpClient.prototype.mergeRequestParams = function (params1, params2) {
      return { ...merge.call(this, params1, params2), adapter }
    } satisfies MergeParams

    // timeline/gantt fetch through `$api.instance.get(url)`, which skips mergeRequestParams
    const instance = nuxtApp.$api.instance
    if (saved.interceptorId !== null) instance.interceptors.request.eject(saved.interceptorId)
    saved.interceptorId = instance.interceptors.request.use((config) => {
      config.adapter = adapter
      return config
    })
  }

  user.value = { ...(saved.user as object), base_roles: { owner: true } } as typeof user.value

  if (!guardRegistered) {
    guardRegistered = true
    nuxtApp.$router.afterEach((to) => {
      if (!VIEW_ROUTE.test(to.path)) uninstall(user, nuxtApp.$api)
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
